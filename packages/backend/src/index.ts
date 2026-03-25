import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getConnection } from "./db/connection.js";
import health from "./routes/health.js";
import workers from "./routes/workers.js";
import machines from "./routes/machines.js";
import schedule from "./routes/schedule.js";

const app = new Hono();

app.use("/*", cors({ origin: ["http://localhost:5173", "http://localhost:3000"] }));

app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}]`, err);
  return c.json({ error: "Internal server error" }, 500);
});

app.route("/api/health", health);
app.route("/api/workers", workers);
app.route("/api/machines", machines);
app.route("/api/schedule", schedule);

app.get("/", (c) => c.text("FactoryMind API"));

// Initialize DuckDB before starting the server
console.log("Initializing DuckDB and loading datasets...");
const startTime = Date.now();

getConnection().then(() => {
  const elapsed = Date.now() - startTime;
  console.log(`Data loaded in ${elapsed}ms`);

  const port = Number(process.env.PORT) || 3001;
  console.log(`Server starting on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}).catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
