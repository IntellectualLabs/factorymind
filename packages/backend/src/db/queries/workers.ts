import { query } from "../connection.js";

interface WorkersQueryParams {
  team?: string;
  shift?: string;
  from?: string;
  to?: string;
}

function sanitize(value: string): string {
  return value.replace(/'/g, "''");
}

function buildWhereClause(params: WorkersQueryParams): string {
  const conditions: string[] = [];
  if (params.team) conditions.push(`sub_team = '${sanitize(params.team)}'`);
  if (params.shift) conditions.push(`sub_shift = '${sanitize(params.shift)}'`);
  if (params.from) conditions.push(`event_date >= '${sanitize(params.from)}'`);
  if (params.to) conditions.push(`event_date <= '${sanitize(params.to)}'`);
  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

export async function getWorkersSummary(params: WorkersQueryParams) {
  const where = buildWhereClause(params);

  const [summary] = await query(`
    SELECT
      COUNT(DISTINCT sub_ID) AS total_workers,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Presence') AS presence_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Absence') AS absence_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Efficacy') AS efficacy_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Feat') AS feat_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Slip') AS slip_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Idea') AS idea_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Lapse') AS lapse_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Resignation') AS resignation_count,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Termination') AS termination_count,
      AVG(CASE WHEN recorded_efficacy IS NOT NULL AND recorded_efficacy != 'None' THEN TRY_CAST(recorded_efficacy AS DOUBLE) END) AS avg_efficacy
    FROM workers
    ${where}
  `);

  const presenceCount = Number(summary.presence_count);
  const absenceCount = Number(summary.absence_count);
  const attendanceRate =
    presenceCount + absenceCount > 0
      ? presenceCount / (presenceCount + absenceCount)
      : 0;

  return {
    totalWorkers: Number(summary.total_workers),
    activeToday: presenceCount,
    attendanceRate: Math.round(attendanceRate * 1000) / 1000,
    avgEfficacy:
      Math.round(Number(summary.avg_efficacy || 0) * 1000) / 1000,
    attritionCount:
      Number(summary.resignation_count) + Number(summary.termination_count),
    eventBreakdown: {
      Presence: Number(summary.presence_count),
      Absence: Number(summary.absence_count),
      Efficacy: Number(summary.efficacy_count),
      Feat: Number(summary.feat_count),
      Slip: Number(summary.slip_count),
      Idea: Number(summary.idea_count),
      Lapse: Number(summary.lapse_count),
      Resignation: Number(summary.resignation_count),
      Termination: Number(summary.termination_count),
    },
  };
}

export async function getWorkersTimeseries(
  params: WorkersQueryParams & { granularity?: string }
) {
  const where = buildWhereClause(params);
  const dateExpr =
    params.granularity === "week"
      ? "CAST(DATE_TRUNC('week', STRPTIME(event_date, '%m/%d/%Y')) AS DATE)"
      : "event_date";

  const rows = await query(`
    SELECT
      CAST(${dateExpr} AS VARCHAR) AS date,
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Presence') AS "Presence",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Absence') AS "Absence",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Efficacy') AS "Efficacy",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Feat') AS "Feat",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Slip') AS "Slip",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Idea') AS "Idea",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Lapse') AS "Lapse",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Resignation') AS "Resignation",
      COUNT(*) FILTER (WHERE behav_comptype_h = 'Termination') AS "Termination"
    FROM workers
    ${where}
    GROUP BY ${dateExpr}
    ORDER BY ${dateExpr}
  `);

  return rows.map((r) => ({
    date: String(r.date),
    Presence: Number(r.Presence),
    Absence: Number(r.Absence),
    Efficacy: Number(r.Efficacy),
    Feat: Number(r.Feat),
    Slip: Number(r.Slip),
    Idea: Number(r.Idea),
    Lapse: Number(r.Lapse),
    Resignation: Number(r.Resignation),
    Termination: Number(r.Termination),
  }));
}

export async function getWorkersHeatmap(
  params: WorkersQueryParams & { metric?: string }
) {
  const where = buildWhereClause(params);
  const metric = params.metric || "attendance";

  let valueExpr: string;
  if (metric === "efficacy") {
    valueExpr = `AVG(CASE WHEN recorded_efficacy IS NOT NULL AND recorded_efficacy != 'None' THEN TRY_CAST(recorded_efficacy AS DOUBLE) END)`;
  } else {
    valueExpr = `CAST(COUNT(*) FILTER (WHERE behav_comptype_h = 'Presence') AS DOUBLE) /
      NULLIF(COUNT(*) FILTER (WHERE behav_comptype_h IN ('Presence', 'Absence')), 0)`;
  }

  const rows = await query(`
    SELECT
      sub_team AS team,
      sub_shift AS shift,
      CAST(event_date AS VARCHAR) AS date,
      ${valueExpr} AS value
    FROM workers
    ${where}
    GROUP BY sub_team, sub_shift, event_date
    ORDER BY sub_team, sub_shift, event_date
  `);

  const grouped: Record<
    string,
    { team: string; shift: string; values: Array<{ date: string; value: number }> }
  > = {};

  for (const row of rows) {
    const key = `${row.team}-${row.shift}`;
    if (!grouped[key]) {
      grouped[key] = {
        team: String(row.team),
        shift: String(row.shift),
        values: [],
      };
    }
    grouped[key].values.push({
      date: String(row.date),
      value: Number(row.value) || 0,
    });
  }

  return Object.values(grouped);
}

export async function getWorkersAttrition(params: WorkersQueryParams) {
  const where = buildWhereClause(params);

  const rows = await query(`
    WITH daily AS (
      SELECT
        CAST(event_date AS VARCHAR) AS date,
        COUNT(*) FILTER (WHERE behav_comptype_h = 'Resignation') AS resignations,
        COUNT(*) FILTER (WHERE behav_comptype_h = 'Termination') AS terminations
      FROM workers
      ${where}
      GROUP BY event_date
      ORDER BY event_date
    )
    SELECT
      date,
      resignations,
      terminations,
      SUM(resignations + terminations) OVER (ORDER BY date) AS cumulative
    FROM daily
  `);

  return rows.map((r) => ({
    date: String(r.date),
    resignations: Number(r.resignations),
    terminations: Number(r.terminations),
    cumulative: Number(r.cumulative),
  }));
}
