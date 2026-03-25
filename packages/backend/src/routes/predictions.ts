import { Hono } from "hono";
import { getCombinedPredictions } from "../db/queries/predictions.js";

const predictions = new Hono();

predictions.get("/", async (c) => {
  const result = await getCombinedPredictions();
  return c.json(result);
});

export default predictions;
