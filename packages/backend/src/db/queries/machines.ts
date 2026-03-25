import { query } from "../connection.js";
import type { DataSource, RiskLevel } from "@factorymind/types";

function riskLevel(score: number): RiskLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

export async function getMachinesSummary(source?: DataSource) {
  let table: string;
  if (source === "manufacturing") {
    table = "manufacturing";
  } else if (source === "iot") {
    table = "iot";
  } else {
    table = "machines_harmonized";
  }

  if (source === "manufacturing") {
    const [row] = await query(`
      WITH per_machine AS (
        SELECT "Machine_ID",
          AVG("Predictive_Maintenance_Score") AS avg_risk,
          AVG(CASE "Efficiency_Status" WHEN 'High' THEN 85 WHEN 'Medium' THEN 55 ELSE 25 END) AS avg_eff,
          MODE("Operation_Mode") AS mode_op
        FROM manufacturing GROUP BY "Machine_ID"
      )
      SELECT
        COUNT(*) AS total_machines,
        COUNT(*) FILTER (WHERE mode_op = 'Active') AS active_count,
        AVG(avg_eff) AS avg_efficiency,
        COUNT(*) FILTER (WHERE avg_risk >= 0.7) AS high_risk,
        COUNT(*) FILTER (WHERE avg_risk >= 0.4 AND avg_risk < 0.7) AS med_risk,
        COUNT(*) FILTER (WHERE avg_risk < 0.4) AS low_risk
      FROM per_machine
    `);
    return {
      totalMachines: Number(row.total_machines),
      activeCount: Number(row.active_count),
      avgEfficiency: Math.round(Number(row.avg_efficiency) * 10) / 10,
      riskDistribution: {
        high: Number(row.high_risk),
        medium: Number(row.med_risk),
        low: Number(row.low_risk),
      },
    };
  }

  if (source === "iot") {
    const [row] = await query(`
      WITH per_machine AS (
        SELECT machine_id,
          AVG(CAST(maintenance_flag AS DOUBLE)) AS avg_flag,
          AVG(efficiency_score) AS avg_eff,
          MODE(production_status) AS mode_status
        FROM iot GROUP BY machine_id
      )
      SELECT
        COUNT(*) AS total_machines,
        COUNT(*) FILTER (WHERE mode_status = 1) AS active_count,
        AVG(avg_eff) AS avg_efficiency,
        COUNT(*) FILTER (WHERE avg_flag >= 0.5) AS high_risk,
        COUNT(*) FILTER (WHERE avg_flag < 0.5 AND avg_eff < 30) AS med_risk,
        COUNT(*) FILTER (WHERE avg_flag < 0.5 AND avg_eff >= 30) AS low_risk
      FROM per_machine
    `);
    return {
      totalMachines: Number(row.total_machines),
      activeCount: Number(row.active_count),
      avgEfficiency: Math.round(Number(row.avg_efficiency) * 10) / 10,
      riskDistribution: {
        high: Number(row.high_risk),
        medium: Number(row.med_risk),
        low: Number(row.low_risk),
      },
    };
  }

  // Harmonized — aggregate per machine first, then count risk categories
  const [row] = await query(`
    WITH per_machine AS (
      SELECT machine_id, AVG(maintenance_risk) AS avg_risk, AVG(efficiency_score) AS avg_eff,
        MODE(operation_mode) AS mode_op
      FROM machines_harmonized GROUP BY machine_id
    )
    SELECT
      COUNT(*) AS total_machines,
      COUNT(*) FILTER (WHERE mode_op = 'Active') AS active_count,
      AVG(avg_eff) AS avg_efficiency,
      COUNT(*) FILTER (WHERE avg_risk >= 0.7) AS high_risk,
      COUNT(*) FILTER (WHERE avg_risk >= 0.4 AND avg_risk < 0.7) AS med_risk,
      COUNT(*) FILTER (WHERE avg_risk < 0.4) AS low_risk
    FROM per_machine
  `);
  return {
    totalMachines: Number(row.total_machines),
    activeCount: Number(row.active_count),
    avgEfficiency: Math.round(Number(row.avg_efficiency) * 10) / 10,
    riskDistribution: {
      high: Number(row.high_risk),
      medium: Number(row.med_risk),
      low: Number(row.low_risk),
    },
  };
}

export async function getMachinesTimeseries(params: {
  source?: DataSource;
  machineId?: string;
  metrics?: string;
  granularity?: string;
}) {
  const source = params.source || "harmonized";
  const ALLOWED_GRAN = ["minute", "hour", "day"] as const;
  const gran = ALLOWED_GRAN.includes(params.granularity as typeof ALLOWED_GRAN[number])
    ? params.granularity!
    : "hour";
  const truncExpr =
    gran === "minute" ? "ts" : `DATE_TRUNC('${gran}', ts)`;

  let machineFilter = "";
  if (params.machineId) {
    machineFilter = `AND machine_id = '${params.machineId.replace(/'/g, "''")}'`;
  }

  const ALLOWED_SOURCES = ["manufacturing", "iot", "harmonized"] as const;
  let sourceFilter = "";
  if (source !== "harmonized" && ALLOWED_SOURCES.includes(source as typeof ALLOWED_SOURCES[number])) {
    sourceFilter = `AND source = '${source}'`;
  }

  const rows = await query(`
    SELECT
      CAST(${truncExpr} AS VARCHAR) AS timestamp,
      machine_id AS "machineId",
      AVG(temperature_raw) AS temperature,
      AVG(vibration_raw) AS vibration,
      AVG(power_raw) AS power,
      AVG(error_rate_pct) AS "errorRate",
      AVG(network_latency) AS "networkLatency",
      AVG(packet_loss) AS "packetLoss"
    FROM machines_harmonized
    WHERE 1=1 ${sourceFilter} ${machineFilter}
    GROUP BY ${truncExpr}, machine_id
    ORDER BY ${truncExpr}, machine_id
    LIMIT 5000
  `);

  return rows.map((r) => ({
    timestamp: String(r.timestamp),
    machineId: String(r.machineId),
    temperature: r.temperature != null ? Number(r.temperature) : null,
    vibration: r.vibration != null ? Number(r.vibration) : null,
    power: r.power != null ? Number(r.power) : null,
    errorRate: r.errorRate != null ? Number(r.errorRate) : null,
    networkLatency:
      r.networkLatency != null ? Number(r.networkLatency) : null,
    packetLoss: r.packetLoss != null ? Number(r.packetLoss) : null,
  }));
}

export async function getMachinesRisk() {
  const rows = await query(`
    SELECT
      machine_id,
      source,
      AVG(maintenance_risk) AS maintenance_score,
      AVG(temperature_raw) AS avg_temp,
      AVG(vibration_raw) AS avg_vibration
    FROM machines_harmonized
    GROUP BY machine_id, source
    ORDER BY AVG(maintenance_risk) DESC
  `);

  return rows.map((r) => ({
    machineId: String(r.machine_id),
    source: String(r.source) as DataSource,
    riskLevel: riskLevel(Number(r.maintenance_score)),
    maintenanceScore:
      Math.round(Number(r.maintenance_score) * 1000) / 1000,
    avgTemp: Math.round(Number(r.avg_temp) * 10) / 10,
    avgVibration: Math.round(Number(r.avg_vibration) * 100) / 100,
  }));
}

export async function getHarmonizedMachines() {
  const rows = await query(`
    SELECT
      machine_id,
      source,
      ANY_VALUE(machine_type) AS machine_type,
      AVG(temp_normalized) AS temp_norm,
      AVG(vibration_normalized) AS vib_norm,
      AVG(power_normalized) AS power_norm,
      AVG(error_rate_pct) AS error_rate_pct,
      MODE(efficiency_status) AS efficiency_status,
      AVG(efficiency_score) AS efficiency_score,
      AVG(maintenance_risk) AS maintenance_risk
    FROM machines_harmonized
    GROUP BY machine_id, source
    ORDER BY source, machine_id
  `);

  return rows.map((r) => ({
    machineId: String(r.machine_id),
    source: String(r.source) as DataSource,
    machineType: r.machine_type ? String(r.machine_type) : null,
    tempNormalized: Math.round(Number(r.temp_norm) * 1000) / 1000,
    vibrationNormalized: Math.round(Number(r.vib_norm) * 1000) / 1000,
    powerNormalized: Math.round(Number(r.power_norm) * 1000) / 1000,
    errorRatePct: Math.round(Number(r.error_rate_pct) * 100) / 100,
    efficiencyStatus: String(r.efficiency_status),
    efficiencyScore: Math.round(Number(r.efficiency_score) * 10) / 10,
    maintenanceRisk: Math.round(Number(r.maintenance_risk) * 1000) / 1000,
    riskLevel: riskLevel(Number(r.maintenance_risk)),
  }));
}
