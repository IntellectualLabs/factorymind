import { Hono } from "hono";
import { getTableCounts } from "../db/connection.js";

const health = new Hono();

health.get("/", async (c) => {
  const tables = await getTableCounts();
  return c.json({ status: "ok", tables });
});

export default health;
