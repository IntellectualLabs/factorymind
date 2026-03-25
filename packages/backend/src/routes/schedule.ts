import { Hono } from "hono";
import type { ScheduleWarning } from "@factorymind/types";
import {
  getAttendancePredictions,
  getMachineRiskPredictions,
  generateWeekPredictions,
  getWorkOrders,
  assignWorkOrder,
  unassignWorkOrder,
} from "../db/queries/scheduling.js";

const schedule = new Hono();

schedule.get("/predictions", async (c) => {
  const weekStart = c.req.query("weekStart") || new Date().toISOString().split("T")[0];
  const [attendancePreds, machinePreds] = await Promise.all([
    getAttendancePredictions(),
    getMachineRiskPredictions(),
  ]);
  const result = generateWeekPredictions(weekStart, attendancePreds, machinePreds);
  return c.json(result);
});

schedule.get("/orders", async (c) => {
  const weekStart = c.req.query("weekStart") || new Date().toISOString().split("T")[0];
  const orders = await getWorkOrders(weekStart);
  return c.json({ orders });
});

schedule.post("/assign", async (c) => {
  let body: { orderId: string; team: string; shift: string; machineId: string; day: string; weekStart: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.orderId || !body.team || !body.shift || !body.machineId || !body.day || !body.weekStart) {
    return c.json({ error: "Missing required fields: orderId, team, shift, machineId, day, weekStart" }, 400);
  }

  // Verify order exists
  const orders = await getWorkOrders(body.weekStart);
  const order = orders.find((o) => o.id === body.orderId);
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  // Get predictions for validation
  const [attendancePreds, machinePreds] = await Promise.all([
    getAttendancePredictions(),
    getMachineRiskPredictions(),
  ]);

  const warnings: ScheduleWarning[] = [];

  // Check attendance
  const teamPred = attendancePreds[body.team];
  if (teamPred) {
    const dayOfWeek = new Date(body.day).toLocaleDateString("en-US", { weekday: "long" });
    const pred = teamPred[dayOfWeek];
    if (pred && pred.rate < 0.75) {
      warnings.push({
        type: "low_attendance",
        severity: "warning",
        message: `${body.team} predicted at ${Math.round(pred.rate * 100)}% capacity on ${dayOfWeek} — consider reassignment`,
      });
    }
    if (pred && Math.round(pred.totalWorkers * pred.rate) < order.crewNeeded) {
      warnings.push({
        type: "capacity_exceeded",
        severity: "error",
        message: `Order requires ${order.crewNeeded} crew, but ${body.team} has only ${Math.round(pred.totalWorkers * pred.rate)} predicted available`,
      });
    }
  }

  // Check machine risk
  const machinePred = machinePreds.find((m) => m.machineId === body.machineId);
  if (machinePred && machinePred.riskLevel === "high") {
    warnings.push({
      type: "maintenance_risk",
      severity: "warning",
      message: `Machine ${body.machineId} has elevated maintenance risk (${machinePred.maintenanceScore}) — avoid heavy workloads`,
    });
  }

  // Persist assignment to DuckDB
  await assignWorkOrder(body.orderId, body.team, body.shift, body.machineId, body.day);

  return c.json({ success: true, warnings });
});

schedule.post("/unassign", async (c) => {
  let body: { orderId: string; weekStart: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.orderId || !body.weekStart) {
    return c.json({ error: "Missing required fields: orderId, weekStart" }, 400);
  }

  await unassignWorkOrder(body.orderId);
  return c.json({ success: true });
});

export default schedule;
