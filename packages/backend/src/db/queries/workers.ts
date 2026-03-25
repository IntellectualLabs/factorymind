import { query } from "../connection.js";

interface WorkersQueryParams {
  team?: string;
  shift?: string;
  from?: string;
  to?: string;
}

const VALID_TEAMS = new Set(Array.from({ length: 24 }, (_, i) => `Team ${i + 1}`));
const VALID_SHIFTS = new Set(["Shift 1", "Shift 2", "Shift 3"]);
const DATE_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

function buildWhereClause(params: WorkersQueryParams): string {
  const conditions: string[] = [];
  if (params.team && VALID_TEAMS.has(params.team)) {
    conditions.push(`sub_team = '${params.team}'`);
  }
  if (params.shift && VALID_SHIFTS.has(params.shift)) {
    conditions.push(`sub_shift = '${params.shift}'`);
  }
  if (params.from && DATE_PATTERN.test(params.from)) {
    conditions.push(`event_date >= '${params.from}'`);
  }
  if (params.to && DATE_PATTERN.test(params.to)) {
    conditions.push(`event_date <= '${params.to}'`);
  }
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

// Gap 1: Efficacy accuracy — compare actual_efficacy_h vs recorded_efficacy
export async function getWorkersEfficacyAccuracy(params: WorkersQueryParams) {
  const where = buildWhereClause(params);
  const baseFilter = `WHERE actual_efficacy_h IS NOT NULL AND actual_efficacy_h != 'None'
    AND recorded_efficacy IS NOT NULL AND recorded_efficacy != 'None'`;
  const fullWhere = where
    ? baseFilter + " AND " + where.replace("WHERE ", "")
    : baseFilter;

  const [summary] = await query(`
    SELECT
      AVG(ABS(TRY_CAST(actual_efficacy_h AS DOUBLE) - TRY_CAST(recorded_efficacy AS DOUBLE))) AS mean_abs_error,
      CORR(TRY_CAST(actual_efficacy_h AS DOUBLE), TRY_CAST(recorded_efficacy AS DOUBLE)) AS correlation,
      AVG(TRY_CAST(actual_efficacy_h AS DOUBLE)) AS avg_actual,
      AVG(TRY_CAST(recorded_efficacy AS DOUBLE)) AS avg_recorded,
      COUNT(*) AS sample_count
    FROM workers
    ${fullWhere}
  `);

  // Distribution of (actual - recorded) bucketed
  const distRows = await query(`
    SELECT
      CASE
        WHEN diff < -0.5 THEN '< -0.5'
        WHEN diff < -0.2 THEN '-0.5 to -0.2'
        WHEN diff < -0.05 THEN '-0.2 to -0.05'
        WHEN diff <= 0.05 THEN 'Accurate'
        WHEN diff <= 0.2 THEN '0.05 to 0.2'
        WHEN diff <= 0.5 THEN '0.2 to 0.5'
        ELSE '> 0.5'
      END AS bucket,
      COUNT(*) AS count
    FROM (
      SELECT TRY_CAST(actual_efficacy_h AS DOUBLE) - TRY_CAST(recorded_efficacy AS DOUBLE) AS diff
      FROM workers
      ${fullWhere}
    ) sub
    GROUP BY bucket
    ORDER BY MIN(diff)
  `);

  return {
    meanAbsError: Math.round(Number(summary.mean_abs_error || 0) * 1000) / 1000,
    correlation: Math.round(Number(summary.correlation || 0) * 1000) / 1000,
    avgActual: Math.round(Number(summary.avg_actual || 0) * 1000) / 1000,
    avgRecorded: Math.round(Number(summary.avg_recorded || 0) * 1000) / 1000,
    sampleCount: Number(summary.sample_count),
    distribution: distRows.map((r) => ({
      bucket: String(r.bucket),
      count: Number(r.count),
    })),
  };
}

// Gap 2: Attrition cause breakdown
export async function getWorkersAttritionCauses(params: WorkersQueryParams) {
  const where = buildWhereClause(params);
  const baseFilter = `WHERE behav_comptype_h IN ('Resignation', 'Termination')
    AND behav_cause_h IS NOT NULL AND behav_cause_h != 'None' AND behav_cause_h != ''`;
  const fullWhere = where
    ? baseFilter + " AND " + where.replace("WHERE ", "")
    : baseFilter;

  const rows = await query(`
    SELECT behav_cause_h AS cause, behav_comptype_h AS event_type, COUNT(*) AS count
    FROM workers
    ${fullWhere}
    GROUP BY behav_cause_h, behav_comptype_h
    ORDER BY count DESC
  `);

  return rows.map((r) => ({
    cause: String(r.cause),
    eventType: String(r.event_type),
    count: Number(r.count),
  }));
}
