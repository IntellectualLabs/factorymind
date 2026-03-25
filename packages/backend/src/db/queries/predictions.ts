import { getAttendancePredictions, getMachineRiskPredictions } from "./scheduling.js";
import { WEEKDAYS } from "./utils.js";
import type {
  AlertSeverity,
  MachinePrediction,
  PredictionAlert,
  PredictionSummary,
  PredictionsResponse,
  RecommendedAction,
} from "@factorymind/types";

type AttendanceData = Record<
  string,
  Record<string, { rate: number; stddev: number; totalWorkers: number; efficacy: number }>
>;

function getTomorrowWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return WEEKDAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

function isWeekend(weekday: string): boolean {
  return weekday === "Saturday" || weekday === "Sunday";
}

function formatMachineLabel(m: MachinePrediction): string {
  if (m.machineType) return `${m.machineType} ${m.machineId}`;
  return `Machine #${m.machineId}`;
}

// ── Pure computation functions (testable without DuckDB) ──

export function computeAlerts(
  attendancePreds: AttendanceData,
  machinePreds: MachinePrediction[]
): PredictionAlert[] {
  const alerts: PredictionAlert[] = [];

  // Machine risk alerts — with enriched context
  for (const machine of machinePreds) {
    const score = machine.maintenanceScore;
    const label = formatMachineLabel(machine);
    const context = `vibration ${machine.avgVibration} Hz, temp ${machine.avgTemp}°C`;
    let severity: AlertSeverity | null = null;
    let message = "";

    if (score >= 0.8) {
      severity = "critical";
      message = `${label} — ${context} (risk ${(score * 100).toFixed(0)}%)`;
    } else if (score >= 0.5) {
      severity = "warning";
      message = `${label} — ${context} (risk ${(score * 100).toFixed(0)}%)`;
    } else if (score >= 0.3) {
      severity = "info";
      message = `${label} — elevated risk ${(score * 100).toFixed(0)}%`;
    }

    if (severity) {
      alerts.push({
        id: `alert-machine-${machine.machineId}`,
        severity,
        source: "machine",
        entity: machine.machineId,
        metric: score,
        message,
        day: getTomorrowWeekday(),
      });
    }
  }

  // Cap machine alerts: top 5 per severity level to avoid alarm fatigue
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const machineAlerts = alerts.filter((a) => a.source === "machine");
  const cappedMachineAlerts: PredictionAlert[] = [];
  for (const sev of ["critical", "warning", "info"] as AlertSeverity[]) {
    const bySev = machineAlerts.filter((a) => a.severity === sev);
    cappedMachineAlerts.push(...bySev.slice(0, 5));
  }

  // Attendance alerts for each day of the upcoming week (keep all — typically fewer)
  const attendanceAlerts: PredictionAlert[] = [];
  for (const weekday of WEEKDAYS) {
    for (const [team, byWeekday] of Object.entries(attendancePreds)) {
      const pred = byWeekday[weekday];
      if (!pred) continue;

      let severity: AlertSeverity | null = null;
      let message = "";

      if (pred.rate < 0.70) {
        severity = "critical";
        message = `${team} predicted at ${Math.round(pred.rate * 100)}% attendance on ${weekday}`;
      } else if (pred.rate < 0.80) {
        severity = "warning";
        message = `${team} attendance forecast below 80% on ${weekday}`;
      }

      if (severity) {
        attendanceAlerts.push({
          id: `alert-team-${team}-${weekday}`,
          severity,
          source: "attendance",
          entity: team,
          metric: pred.rate,
          message,
          day: weekday,
        });
      }
    }
  }

  const combined = [...cappedMachineAlerts, ...attendanceAlerts];
  combined.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return combined;
}

export function computeSummary(
  attendancePreds: AttendanceData,
  machinePreds: MachinePrediction[],
  actionsCount: number
): PredictionSummary {
  const tomorrow = getTomorrowWeekday();

  let totalRate = 0;
  let totalConf = 0;
  let totalAvailable = 0;
  let totalHeadcount = 0;
  let teamCount = 0;

  for (const [, byWeekday] of Object.entries(attendancePreds)) {
    const pred = byWeekday[tomorrow] || { rate: 0.85, stddev: 0.05, totalWorkers: 20, efficacy: 0.7 };
    totalRate += pred.rate;
    totalConf += Math.max(0, 1 - pred.stddev * 1.5);
    totalAvailable += Math.round(pred.rate * pred.totalWorkers);
    totalHeadcount += pred.totalWorkers;
    teamCount++;
  }

  const avgRate = teamCount > 0 ? totalRate / teamCount : 0.85;
  const avgConf = teamCount > 0 ? totalConf / teamCount : 0.8;

  // Workforce capacity: percentage of total workers expected to be available
  const workforceCapacity = totalHeadcount > 0
    ? Math.round((totalAvailable / totalHeadcount) * 1000) / 10
    : 85;

  const machinesAtRisk = machinePreds.filter((m) => m.maintenanceScore >= 0.5).length;

  return {
    tomorrowAttendance: Math.round(avgRate * 1000) / 1000,
    attendanceConf: Math.round(avgConf * 1000) / 1000,
    machinesAtRisk,
    workforceCapacity,
    totalWorkers: totalHeadcount,
    openActions: actionsCount,
  };
}

export function computeActions(
  attendancePreds: AttendanceData,
  machinePreds: MachinePrediction[]
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // Critical machines: individual actions with causal context
  const criticalMachines = machinePreds.filter((m) => m.maintenanceScore >= 0.8);
  for (const machine of criticalMachines) {
    const label = formatMachineLabel(machine);
    actions.push({
      id: `action-maintenance-${machine.machineId}`,
      severity: "critical",
      category: "maintenance",
      title: `Schedule Maintenance — ${label}`,
      description: `Vibration ${machine.avgVibration} Hz, temp ${machine.avgTemp}°C, risk ${(machine.maintenanceScore * 100).toFixed(0)}%. Schedule maintenance before next production cycle.`,
      entity: machine.machineId,
      metric: machine.maintenanceScore,
      day: getTomorrowWeekday(),
      navigateTo: "/scheduler",
    });
  }

  // Warning machines: ONE grouped action instead of 30 individual ones
  const warningMachines = machinePreds
    .filter((m) => m.maintenanceScore >= 0.5 && m.maintenanceScore < 0.8)
    .sort((a, b) => b.maintenanceScore - a.maintenanceScore);

  if (warningMachines.length > 0) {
    const top = warningMachines[0];
    const topLabel = formatMachineLabel(top);
    actions.push({
      id: "action-monitoring-grouped",
      severity: "warning",
      category: "monitoring",
      title: `Monitor ${warningMachines.length} Machines with Elevated Risk`,
      description: `${warningMachines.length} machines have maintenance risk 50-80%. Top concern: ${topLabel} at ${(top.maintenanceScore * 100).toFixed(0)}% (vibration ${top.avgVibration} Hz, temp ${top.avgTemp}°C). Increase inspection frequency.`,
      entity: `${warningMachines.length} machines`,
      metric: top.maintenanceScore,
      day: getTomorrowWeekday(),
      navigateTo: "/analytics/machines",
    });
  }

  // Staffing recommendations for each day
  for (const weekday of WEEKDAYS) {
    for (const [team, byWeekday] of Object.entries(attendancePreds)) {
      const pred = byWeekday[weekday];
      if (!pred) continue;

      if (pred.rate < 0.70) {
        const altTeam = findAltTeam(team, weekday, attendancePreds);
        actions.push({
          id: `action-staffing-${team}-${weekday}`,
          severity: "critical",
          category: "staffing",
          title: `Reassign ${team} Orders`,
          description: `${team} predicted at ${Math.round(pred.rate * 100)}% attendance on ${weekday}. Consider reassigning critical orders to ${altTeam}.`,
          entity: team,
          metric: pred.rate,
          day: weekday,
          navigateTo: "/analytics/workforce",
        });
      } else if (pred.rate < 0.80 && isWeekend(weekday)) {
        actions.push({
          id: `action-staffing-weekend-${team}-${weekday}`,
          severity: "warning",
          category: "staffing",
          title: `Weekend Staffing — ${team}`,
          description: `${team} predicted at ${Math.round(pred.rate * 100)}% on ${weekday}. Review weekend overtime availability.`,
          entity: team,
          metric: pred.rate,
          day: weekday,
          navigateTo: "/analytics/workforce",
        });
      }
    }
  }

  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  actions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return actions;
}

function findAltTeam(
  excludeTeam: string,
  weekday: string,
  attendancePreds: AttendanceData
): string {
  let bestTeam = "another available team";
  let bestAvailable = 0;

  for (const [team, byWeekday] of Object.entries(attendancePreds)) {
    if (team === excludeTeam) continue;
    const pred = byWeekday[weekday];
    if (!pred) continue;

    const available = pred.rate * pred.totalWorkers;
    if (available > bestAvailable) {
      bestAvailable = available;
      bestTeam = team;
    }
  }

  return bestTeam;
}

// ── Main entry point (calls DuckDB, delegates to pure functions) ──

export async function getCombinedPredictions(): Promise<PredictionsResponse> {
  const [attendancePreds, machinePreds] = await Promise.all([
    getAttendancePredictions(),
    getMachineRiskPredictions(),
  ]);

  const alerts = computeAlerts(attendancePreds, machinePreds);
  const actions = computeActions(attendancePreds, machinePreds);
  const summary = computeSummary(attendancePreds, machinePreds, actions.length);

  return { alerts, summary, actions };
}
