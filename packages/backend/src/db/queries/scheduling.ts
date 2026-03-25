import { query } from "../connection.js";
import type { RiskLevel, MachinePrediction, TeamPrediction } from "@factorymind/types";

function riskLevel(score: number): RiskLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function recommendedLoad(risk: RiskLevel): "heavy" | "normal" | "light" | "avoid" {
  switch (risk) {
    case "high": return "avoid";
    case "medium": return "light";
    case "low": return "heavy";
  }
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function getAttendancePredictions(): Promise<
  Record<string, Record<string, { rate: number; stddev: number; totalWorkers: number }>>
> {
  // Rolling 8-week average absence rate per team, per day-of-week
  const rows = await query(`
    WITH parsed AS (
      SELECT *, STRPTIME(event_date, '%m/%d/%Y')::DATE AS parsed_date
      FROM workers
    ),
    daily AS (
      SELECT
        sub_team,
        event_weekday_num,
        parsed_date,
        COUNT(*) FILTER (WHERE behav_comptype_h = 'Absence') AS absences,
        COUNT(DISTINCT sub_ID) AS total_workers,
        AVG(CASE WHEN recorded_efficacy IS NOT NULL AND recorded_efficacy != 'None'
            THEN TRY_CAST(recorded_efficacy AS DOUBLE) END) AS avg_efficacy
      FROM parsed
      GROUP BY sub_team, event_weekday_num, parsed_date
    )
    SELECT
      sub_team AS team,
      event_weekday_num AS weekday_num,
      AVG(CAST(absences AS DOUBLE) / NULLIF(total_workers, 0)) AS avg_absence_rate,
      COALESCE(STDDEV(CAST(absences AS DOUBLE) / NULLIF(total_workers, 0)), 0.05) AS stddev_absence_rate,
      AVG(total_workers) AS avg_total_workers,
      AVG(avg_efficacy) AS avg_efficacy
    FROM daily
    WHERE parsed_date >= (SELECT MAX(parsed_date) - INTERVAL 56 DAY FROM daily)
    GROUP BY sub_team, event_weekday_num
    ORDER BY sub_team, event_weekday_num
  `);

  const predictions: Record<
    string,
    Record<string, { rate: number; stddev: number; totalWorkers: number; efficacy: number }>
  > = {};

  for (const row of rows) {
    const team = String(row.team);
    const weekdayNum = Number(row.weekday_num);
    const weekday = WEEKDAYS[weekdayNum] || `Day${weekdayNum}`;
    if (!predictions[team]) predictions[team] = {};
    predictions[team][weekday] = {
      rate: 1 - Number(row.avg_absence_rate),
      stddev: Number(row.stddev_absence_rate),
      totalWorkers: Math.round(Number(row.avg_total_workers)),
      efficacy: Math.round(Number(row.avg_efficacy || 0.7) * 1000) / 1000,
    };
  }

  return predictions;
}

export async function getMachineRiskPredictions(): Promise<MachinePrediction[]> {
  const rows = await query(`
    SELECT
      machine_id,
      AVG(maintenance_risk) AS maintenance_score
    FROM machines_harmonized
    GROUP BY machine_id
    ORDER BY AVG(maintenance_risk) DESC
  `);

  return rows.map((r) => {
    const score = Number(r.maintenance_score);
    const risk = riskLevel(score);
    return {
      machineId: String(r.machine_id),
      riskLevel: risk,
      maintenanceScore: Math.round(score * 1000) / 1000,
      recommendedLoad: recommendedLoad(risk),
    };
  });
}

export function generateWeekPredictions(
  weekStart: string,
  attendancePreds: Record<string, Record<string, { rate: number; stddev: number; totalWorkers: number; efficacy: number }>>,
  machinePreds: MachinePrediction[]
) {
  const startDate = new Date(weekStart);
  const days: Array<{
    date: string;
    weekday: string;
    teams: TeamPrediction[];
    machines: MachinePrediction[];
  }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const weekday = WEEKDAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

    const teams: TeamPrediction[] = [];
    for (const [team, byWeekday] of Object.entries(attendancePreds)) {
      const pred = byWeekday[weekday] || { rate: 0.85, stddev: 0.05, totalWorkers: 20, efficacy: 0.7 };
      const available = Math.round(pred.totalWorkers * pred.rate);

      // Infer shift from team name or use all 3 shifts
      const shifts = ["Shift 1", "Shift 2", "Shift 3"];
      for (const shift of shifts) {
        teams.push({
          team,
          shift,
          predictedAttendance: Math.round(pred.rate * 1000) / 1000,
          confidence: Math.max(0, Math.round((1 - pred.stddev * 1.5) * 1000) / 1000),
          totalWorkers: pred.totalWorkers,
          predictedAvailable: available,
          predictedEfficacy: pred.efficacy,
        });
      }
    }

    days.push({ date: dateStr, weekday, teams, machines: machinePreds });
  }

  return { days };
}

// Mock work orders
let orderCounter = 0;
export function generateMockWorkOrders(weekStart: string) {
  const types = ["Welding", "Assembly", "Quality Check", "Packaging", "Maintenance", "CNC Machining"];
  const priorities = ["high", "medium", "low"] as const;
  const orders = [];

  for (let i = 0; i < 20; i++) {
    orderCounter++;
    orders.push({
      id: `WO-${String(orderCounter).padStart(4, "0")}`,
      description: `${types[i % types.length]} - Batch ${100 + i}`,
      crewNeeded: Math.floor(Math.random() * 8) + 3,
      machineType: types[i % types.length],
      priority: priorities[i % 3],
      assignedTeam: null,
      assignedShift: null,
      assignedMachineId: null,
      assignedDay: null,
    });
  }

  return orders;
}
