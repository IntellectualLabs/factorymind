import { Hono } from "hono";
import {
  getWorkersSummary,
  getWorkersTimeseries,
  getWorkersHeatmap,
  getWorkersAttrition,
} from "../db/queries/workers.js";

const workers = new Hono();

workers.get("/summary", async (c) => {
  const { team, shift, from, to } = c.req.query();
  const result = await getWorkersSummary({ team, shift, from, to });
  return c.json(result);
});

workers.get("/timeseries", async (c) => {
  const { team, shift, from, to, granularity } = c.req.query();
  const result = await getWorkersTimeseries({ team, shift, from, to, granularity });
  return c.json(result);
});

workers.get("/heatmap", async (c) => {
  const { team, shift, from, to, metric } = c.req.query();
  const result = await getWorkersHeatmap({ team, shift, from, to, metric });
  return c.json(result);
});

workers.get("/attrition", async (c) => {
  const { from, to } = c.req.query();
  const result = await getWorkersAttrition({ from, to });
  return c.json(result);
});

export default workers;
