import { describe, it, expect, vi } from "vitest";

// Mock the DuckDB connection to avoid native module dependency in tests
vi.mock("../../connection.js", () => ({
  query: vi.fn().mockResolvedValue([]),
}));

import { computeAlerts, computeSummary, computeActions } from "../predictions.js";
import type { MachinePrediction } from "@factorymind/types";

// ── Test fixtures ──

function makeAttendance(overrides: Record<string, Record<string, Partial<{ rate: number; stddev: number; totalWorkers: number; efficacy: number }>>>) {
  const defaults = { rate: 0.85, stddev: 0.05, totalWorkers: 20, efficacy: 0.7 };
  const result: Record<string, Record<string, { rate: number; stddev: number; totalWorkers: number; efficacy: number }>> = {};
  for (const [team, byDay] of Object.entries(overrides)) {
    result[team] = {};
    for (const [day, vals] of Object.entries(byDay)) {
      result[team][day] = { ...defaults, ...vals };
    }
  }
  return result;
}

function makeMachines(...machines: Array<{ id: string; score: number; type?: string; source?: string; temp?: number; vib?: number }>): MachinePrediction[] {
  return machines.map((m) => ({
    machineId: m.id,
    machineType: m.type || null,
    source: m.source || "manufacturing",
    riskLevel: m.score >= 0.7 ? "high" : m.score >= 0.4 ? "medium" : "low",
    maintenanceScore: m.score,
    recommendedLoad: m.score >= 0.7 ? "avoid" : m.score >= 0.4 ? "light" : "heavy",
    avgTemp: m.temp || 60,
    avgVibration: m.vib || 2.5,
  }));
}

// ── computeAlerts ──

describe("computeAlerts", () => {
  it("generates critical alert for machine risk >= 0.8", () => {
    const machines = makeMachines({ id: "M-001", score: 0.85, type: "CNC" });
    const alerts = computeAlerts({}, machines);
    const machineAlerts = alerts.filter((a) => a.source === "machine");
    expect(machineAlerts.length).toBe(1);
    expect(machineAlerts[0].severity).toBe("critical");
    expect(machineAlerts[0].message).toContain("CNC M-001");
  });

  it("includes causal metrics in alert message", () => {
    const machines = makeMachines({ id: "M-001", score: 0.85, temp: 75.5, vib: 3.2 });
    const alerts = computeAlerts({}, machines);
    expect(alerts[0].message).toContain("vibration 3.2 Hz");
    expect(alerts[0].message).toContain("temp 75.5°C");
  });

  it("generates warning alert for machine risk 0.5-0.8", () => {
    const machines = makeMachines({ id: "M-002", score: 0.6 });
    const alerts = computeAlerts({}, machines);
    const machineAlerts = alerts.filter((a) => a.source === "machine");
    expect(machineAlerts.length).toBe(1);
    expect(machineAlerts[0].severity).toBe("warning");
  });

  it("generates info alert for machine risk 0.3-0.5", () => {
    const machines = makeMachines({ id: "M-003", score: 0.35 });
    const alerts = computeAlerts({}, machines);
    const machineAlerts = alerts.filter((a) => a.source === "machine");
    expect(machineAlerts.length).toBe(1);
    expect(machineAlerts[0].severity).toBe("info");
  });

  it("generates no alert for machine risk < 0.3", () => {
    const machines = makeMachines({ id: "M-004", score: 0.2 });
    const alerts = computeAlerts({}, machines);
    const machineAlerts = alerts.filter((a) => a.source === "machine");
    expect(machineAlerts.length).toBe(0);
  });

  it("caps machine alerts to top 5 per severity level", () => {
    const machines = Array.from({ length: 10 }, (_, i) =>
      makeMachines({ id: `M-${i}`, score: 0.5 + i * 0.01 })[0]
    );
    const alerts = computeAlerts({}, machines);
    const warningAlerts = alerts.filter((a) => a.source === "machine" && a.severity === "warning");
    expect(warningAlerts.length).toBe(5);
  });

  it("generates critical attendance alert for rate < 70%", () => {
    const attendance = makeAttendance({
      "Team 1": { Monday: { rate: 0.65 } },
    });
    const alerts = computeAlerts(attendance, []);
    const teamAlerts = alerts.filter((a) => a.source === "attendance");
    expect(teamAlerts.length).toBe(1);
    expect(teamAlerts[0].severity).toBe("critical");
    expect(teamAlerts[0].day).toBe("Monday");
  });

  it("generates warning attendance alert for rate 70-80%", () => {
    const attendance = makeAttendance({
      "Team 2": { Tuesday: { rate: 0.75 } },
    });
    const alerts = computeAlerts(attendance, []);
    const teamAlerts = alerts.filter((a) => a.source === "attendance");
    expect(teamAlerts.length).toBe(1);
    expect(teamAlerts[0].severity).toBe("warning");
  });

  it("generates no alert for attendance >= 80%", () => {
    const attendance = makeAttendance({
      "Team 3": { Wednesday: { rate: 0.85 } },
    });
    const alerts = computeAlerts(attendance, []);
    const teamAlerts = alerts.filter((a) => a.source === "attendance");
    expect(teamAlerts.length).toBe(0);
  });

  it("sorts alerts by severity: critical first", () => {
    const machines = makeMachines(
      { id: "M-info", score: 0.35 },
      { id: "M-crit", score: 0.9 },
      { id: "M-warn", score: 0.6 }
    );
    const alerts = computeAlerts({}, machines);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[1].severity).toBe("warning");
    expect(alerts[2].severity).toBe("info");
  });

  it("returns empty array for no machines and no attendance data", () => {
    const alerts = computeAlerts({}, []);
    expect(alerts).toEqual([]);
  });
});

// ── computeSummary ──

describe("computeSummary", () => {
  it("computes workforce capacity as a percentage", () => {
    const attendance = makeAttendance({
      "Team 1": { Monday: { rate: 0.9, totalWorkers: 100 } },
    });
    const summary = computeSummary(attendance, [], 0);
    expect(summary.workforceCapacity).toBeGreaterThan(0);
    expect(summary.workforceCapacity).toBeLessThanOrEqual(100);
    expect(summary.totalWorkers).toBeGreaterThan(0);
  });

  it("counts machines at risk (score >= 0.5)", () => {
    const machines = makeMachines(
      { id: "M-1", score: 0.8 },
      { id: "M-2", score: 0.5 },
      { id: "M-3", score: 0.3 }
    );
    const summary = computeSummary({}, machines, 0);
    expect(summary.machinesAtRisk).toBe(2);
  });

  it("includes total workers count", () => {
    const attendance = makeAttendance({
      "Team 1": { Monday: { totalWorkers: 50 } },
      "Team 2": { Monday: { totalWorkers: 30 } },
    });
    const summary = computeSummary(attendance, [], 3);
    // totalWorkers sums workers for the day matching getTomorrowWeekday()
    // Both teams only have Monday data; if tomorrow isn't Monday, fallback defaults (20 each) apply
    expect(summary.totalWorkers).toBeGreaterThan(0);
    expect(summary.openActions).toBe(3);
  });

  it("handles empty data gracefully", () => {
    const summary = computeSummary({}, [], 0);
    expect(summary.workforceCapacity).toBe(85);
    expect(summary.totalWorkers).toBe(0);
    expect(summary.machinesAtRisk).toBe(0);
    expect(summary.openActions).toBe(0);
  });
});

// ── computeActions ──

describe("computeActions", () => {
  it("generates individual maintenance action for machine risk >= 0.8", () => {
    const machines = makeMachines({ id: "CNC-7", score: 0.87, type: "CNC", temp: 75, vib: 3.1 });
    const actions = computeActions({}, machines);
    const maintenance = actions.filter((a) => a.category === "maintenance");
    expect(maintenance.length).toBe(1);
    expect(maintenance[0].severity).toBe("critical");
    expect(maintenance[0].title).toContain("CNC CNC-7");
    expect(maintenance[0].description).toContain("Vibration 3.1 Hz");
  });

  it("generates ONE grouped monitoring action for warning machines", () => {
    const machines = makeMachines(
      { id: "M-1", score: 0.55 },
      { id: "M-2", score: 0.52 },
      { id: "M-3", score: 0.51 }
    );
    const actions = computeActions({}, machines);
    const monitoring = actions.filter((a) => a.category === "monitoring");
    expect(monitoring.length).toBe(1);
    expect(monitoring[0].title).toContain("3 Machines");
    expect(monitoring[0].entity).toBe("3 machines");
  });

  it("generates staffing action with alt team for attendance < 70%", () => {
    const attendance = makeAttendance({
      "Team 1": { Monday: { rate: 0.6, totalWorkers: 20 } },
      "Team 2": { Monday: { rate: 0.9, totalWorkers: 25 } },
    });
    const actions = computeActions(attendance, []);
    const staffing = actions.filter((a) => a.category === "staffing" && a.severity === "critical");
    expect(staffing.length).toBe(1);
    expect(staffing[0].description).toContain("Team 2");
  });

  it("generates weekend staffing alert for attendance < 80% on weekend", () => {
    const attendance = makeAttendance({
      "Team 3": { Saturday: { rate: 0.72 } },
    });
    const actions = computeActions(attendance, []);
    const weekend = actions.filter((a) => a.title.includes("Weekend"));
    expect(weekend.length).toBe(1);
    expect(weekend[0].severity).toBe("warning");
    expect(weekend[0].day).toBe("Saturday");
  });

  it("sorts actions by severity", () => {
    const machines = makeMachines(
      { id: "M-warn", score: 0.55 },
      { id: "M-crit", score: 0.9 }
    );
    const actions = computeActions({}, machines);
    expect(actions[0].severity).toBe("critical");
    expect(actions[1].severity).toBe("warning");
  });

  it("returns empty array when no thresholds triggered", () => {
    const attendance = makeAttendance({
      "Team 1": { Monday: { rate: 0.9 } },
    });
    const machines = makeMachines({ id: "M-1", score: 0.2 });
    const actions = computeActions(attendance, machines);
    expect(actions.length).toBe(0);
  });
});
