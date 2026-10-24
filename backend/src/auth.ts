import { bearerAuth } from "hono/bearer-auth";
import { createMiddleware } from "hono/factory";

const requireToken = createMiddleware(async (c, next) => {
    const token = process.env.ADMIN_API_TOKEN
    if (!token) {
        console.error("ADMIN_API_TOKEN is not set")
        return c.json({error: "Server misconfiguration"}, 500)
    }
    if (token.length < 32) {
        console.error("ADMIN_API_TOKEN is too short")
        return c.json({error: "Server misconfiguration"}, 500)
    }
    return bearerAuth({ token }) (c, next)
})

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

export { requireToken, allowedOrigins }