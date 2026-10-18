import { Hono } from "hono";
import prisma from "../database.js"
import { parseId } from "../params.js"

const router = new Hono()

router.get("/", async (c) => {
    const manufacturers = await prisma.manufacturer.findMany()
    return c.json(manufacturers)
})

router.get("/:id", async (c) => {
    const id = parseId(c.req.param("id"))
    if (id === null) {
        return c.json({ error: "id must be a positive integer" }, 400)
    }
    const manufacturer = await prisma.manufacturer.findUnique({
        where: { id }
    })
    if (!manufacturer) {
        return c.json({ error: "Manufacturer not found" }, 404)
    }
    return c.json(manufacturer)
})

router.post("/", async (c) => {
    const body = await c.req.json()
    const manufacturer = await prisma.manufacturer.create({ data: body })
    return c.json(manufacturer)
})

router.put("/:id", async (c) => {
    const id = parseId(c.req.param("id"))
    if (id === null) {
        return c.json({ error: "id must be a positive integer" }, 400)
    }
    const body = await c.req.json()
    const manufacturer = await prisma.manufacturer.update({ where: { id }, data: body })
    return c.json(manufacturer)
})

router.delete("/:id", async (c) => {
    const id = parseId(c.req.param("id"))
    if (id === null) {
        return c.json({ error: "id must be a positive integer" }, 400)
    }
    const deleted = await prisma.manufacturer.delete({ where: { id } })
    return c.json(deleted)
})

export default router