import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { requireToken, allowedOrigins } from "./auth.js";
import systemsRouter from "./routes/systems.js"
import manufacturerRouter from "./routes/manufacturers.js";
import cpuRouter from "./routes/cpus.js"
import gpuRouter from "./routes/gpus.js"

const app = new Hono()

app.use("/*", secureHeaders())
app.use("/*", cors({ origin: allowedOrigins }))
app.use("/*", bodyLimit({ maxSize: 64 * 1024 }))

// Admin boundary. PUT and DELETE are always writes, so they are blanket-gated.
// POST is a write only on the four collection roots: /systems/recommend and
// /systems/filter are public reads the frontend calls with no credentials, and
// they must stay unauthenticated.
app.on(["PUT", "DELETE"], "/*", requireToken)
for (const path of ["/systems", "/manufacturers", "/cpus", "/gpus"]) {
    app.on("POST", path, requireToken)
}

app.route("/systems", systemsRouter)
app.route("/manufacturers", manufacturerRouter)
app.route("/cpus", cpuRouter)
app.route("/gpus", gpuRouter)

serve({ fetch: app.fetch, port: 3001 })
