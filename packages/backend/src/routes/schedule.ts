import { Hono } from "hono";
import type { ScheduleWarning, WorkOrder } from "@factorymind/types";
import {
  getAttendancePredictions,
  getMachineRiskPredictions,
  generateWeekPredictions,
  generateMockWorkOrders,
} from "../db/queries/scheduling.js";

const schedule = new Hono();

// In-memory store for work orders per week (capped at 10 weeks)
const MAX_WEEKS = 10;
const weeklyOrders = new Map<string, WorkOrder[]>();

function getOrCreateOrders(weekStart: string): WorkOrder[] {
  if (!weeklyOrders.has(weekStart)) {
    if (weeklyOrders.size >= MAX_WEEKS) {
      const oldest = weeklyOrders.keys().next().value!;
      weeklyOrders.delete(oldest);
    }
    weeklyOrders.set(weekStart, generateMockWorkOrders(weekStart));
  }
  return weeklyOrders.get(weekStart)!;
}

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
  return c.json({ orders: getOrCreateOrders(weekStart) });
});

schedule.post("/assign", async (c) => {
  const body = await c.req.json<{
    orderId: string;
    team: string;
    shift: string;
    machineId: string;
    day: string;
    weekStart: string;
  }>();

  const orders = getOrCreateOrders(body.weekStart);

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

  // Apply assignment
  order.assignedTeam = body.team;
  order.assignedShift = body.shift;
  order.assignedMachineId = body.machineId;
  order.assignedDay = body.day;

  return c.json({ success: true, warnings });
});

schedule.post("/unassign", async (c) => {
  const body = await c.req.json<{
    orderId: string;
    weekStart: string;
  }>();

  const orders = getOrCreateOrders(body.weekStart);
  const order = orders.find((o) => o.id === body.orderId);
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  order.assignedTeam = null;
  order.assignedShift = null;
  order.assignedMachineId = null;
  order.assignedDay = null;

  return c.json({ success: true });
});

export default schedule;
