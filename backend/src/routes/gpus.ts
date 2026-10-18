import { Hono } from "hono";
import prisma from "../database.js"
import { parseId } from "../params.js"

const router = new Hono()

router.get("/", async (c) => {
    const gpus = await prisma.gpu.findMany({
        include: {
            manufacturer: true
        }
    })
    return c.json(gpus)
})

router.get("/:id", async (c) => {
    const id = parseId(c.req.param("id"))
    if (id === null) {
        return c.json({ error: "id must be a positive integer" }, 400)
    }
    const gpu = await prisma.gpu.findUnique({
        where: { id },
        include: { manufacturer: true }
    })
    if (!gpu) {
        return c.json({ error: "gpu not found" }, 404)
    }
    return c.json(gpu)
})

router.post("/", async (c) => {
    const body = await c.req.json()
    const gpu = await prisma.gpu.create({ data: body })
    return c.json(gpu)
})

router.put("/:id", async (c) => {
    const id = parseId(c.req.param("id"))
    if (id === null) {
        return c.json({ error: "id must be a positive integer" }, 400)
    }
    const body = await c.req.json()
    const gpu = await prisma.gpu.update({ where: { id }, data: body })
    return c.json(gpu)
})

router.delete("/:id", async (c) => {
    const id = parseId(c.req.param("id"))
    if (id === null) {
        return c.json({ error: "id must be a positive integer" }, 400)
    }
    const deleted = await prisma.gpu.delete({ where: { id } })
    return c.json(deleted)
})

export default router