import { bearerAuth } from "hono/bearer-auth";

const token = process.env.ADMIN_API_TOKEN
if (!token) {
    throw new Error("ADMIN_API_TOKEN is not set")
}
if (token.length < 32) {
    throw new Error("ADMIN_API_TOKEN is too short, use at least 32 characters")
}

const requireToken = bearerAuth({ token })

export { requireToken }
