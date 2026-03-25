import { Hono } from "hono";
import type { DataSource } from "@factorymind/types";
import {
  getMachinesSummary,
  getMachinesTimeseries,
  getMachinesRisk,
  getHarmonizedMachines,
} from "../db/queries/machines.js";

const machines = new Hono();

machines.get("/summary", async (c) => {
  const source = c.req.query("source") as DataSource | undefined;
  const result = await getMachinesSummary(source);
  return c.json(result);
});

machines.get("/timeseries", async (c) => {
  const { source, machineId, metrics, granularity } = c.req.query();
  const result = await getMachinesTimeseries({
    source: source as DataSource | undefined,
    machineId,
    metrics,
    granularity,
  });
  return c.json(result);
});

machines.get("/risk", async (c) => {
  const result = await getMachinesRisk();
  return c.json(result);
});

machines.get("/harmonized", async (c) => {
  const result = await getHarmonizedMachines();
  return c.json(result);
});

export default machines;
