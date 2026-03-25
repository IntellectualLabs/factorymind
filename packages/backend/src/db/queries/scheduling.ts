import { query } from "../connection.js";
import type { MachinePrediction, TeamPrediction } from "@factorymind/types";
import { riskLevel, recommendedLoad, WEEKDAYS } from "./utils.js";

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
      ANY_VALUE(machine_type) AS machine_type,
      ANY_VALUE(source) AS source,
      AVG(maintenance_risk) AS maintenance_score,
      AVG(temperature_raw) AS avg_temp,
      AVG(vibration_raw) AS avg_vibration
    FROM machines_harmonized
    GROUP BY machine_id
    ORDER BY AVG(maintenance_risk) DESC
  `);

  return rows.map((r) => {
    const score = Number(r.maintenance_score);
    const risk = riskLevel(score);
    return {
      machineId: String(r.machine_id),
      machineType: r.machine_type ? String(r.machine_type) : null,
      source: String(r.source || "manufacturing"),
      riskLevel: risk,
      maintenanceScore: Math.round(score * 1000) / 1000,
      recommendedLoad: recommendedLoad(risk),
      avgTemp: Math.round(Number(r.avg_temp || 0) * 10) / 10,
      avgVibration: Math.round(Number(r.avg_vibration || 0) * 100) / 100,
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

// Work order persistence via DuckDB

export async function getWorkOrders(weekStart: string) {
  // Check if orders exist for this week
  const existing = await query(
    `SELECT id, description, crew_needed, machine_type, priority,
            assigned_team, assigned_shift, assigned_machine_id, assigned_day
     FROM work_orders WHERE week_start = '${weekStart.replace(/'/g, "''")}'
     ORDER BY id`
  );

  if (existing.length > 0) {
    return existing.map((r) => ({
      id: String(r.id),
      description: String(r.description),
      crewNeeded: Number(r.crew_needed),
      machineType: String(r.machine_type),
      priority: String(r.priority) as "high" | "medium" | "low",
      assignedTeam: r.assigned_team ? String(r.assigned_team) : null,
      assignedShift: r.assigned_shift ? String(r.assigned_shift) : null,
      assignedMachineId: r.assigned_machine_id ? String(r.assigned_machine_id) : null,
      assignedDay: r.assigned_day ? String(r.assigned_day) : null,
    }));
  }

  // Seed mock orders for this week
  const types = ["Welding", "Assembly", "Quality Check", "Packaging", "Maintenance", "CNC Machining"];
  const priorities = ["high", "medium", "low"] as const;
  const safeWeek = weekStart.replace(/'/g, "''");

  for (let i = 0; i < 20; i++) {
    const id = `WO-${safeWeek.replace(/-/g, "")}-${String(i + 1).padStart(2, "0")}`;
    const type = types[i % types.length];
    const prio = priorities[i % 3];
    // Deterministic crew based on index (not random — so restarts produce same data)
    const crew = 3 + ((i * 7 + 5) % 8);
    await query(
      `INSERT INTO work_orders (id, week_start, description, crew_needed, machine_type, priority)
       VALUES ('${id}', '${safeWeek}', '${type} - Batch ${100 + i}', ${crew}, '${type}', '${prio}')`
    );
  }

  return getWorkOrders(weekStart); // Recurse once to read back
}

export async function assignWorkOrder(
  orderId: string, team: string, shift: string, machineId: string, day: string
) {
  const safeId = orderId.replace(/'/g, "''");
  await query(
    `UPDATE work_orders SET
       assigned_team = '${team.replace(/'/g, "''")}',
       assigned_shift = '${shift.replace(/'/g, "''")}',
       assigned_machine_id = '${machineId.replace(/'/g, "''")}',
       assigned_day = '${day.replace(/'/g, "''")}'
     WHERE id = '${safeId}'`
  );
}

export async function unassignWorkOrder(orderId: string) {
  const safeId = orderId.replace(/'/g, "''");
  await query(
    `UPDATE work_orders SET
       assigned_team = NULL, assigned_shift = NULL,
       assigned_machine_id = NULL, assigned_day = NULL
     WHERE id = '${safeId}'`
  );
}
