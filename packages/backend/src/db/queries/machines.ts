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
  if (params.machineId && /^[A-Za-z0-9_-]+$/.test(params.machineId)) {
    machineFilter = `AND machine_id = '${params.machineId}'`;
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
      AVG(packet_loss) AS "packetLoss",
      AVG(cycle_time) AS "cycleTime",
      AVG(pressure) AS pressure,
      AVG(material_flow_rate) AS "materialFlowRate",
      AVG(CAST(downtime_minutes AS DOUBLE)) AS "downtimeMinutes",
      AVG(efficiency_score) AS "efficiencyScore"
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
    cycleTime: r.cycleTime != null ? Number(r.cycleTime) : null,
    pressure: r.pressure != null ? Number(r.pressure) : null,
    materialFlowRate: r.materialFlowRate != null ? Number(r.materialFlowRate) : null,
    downtimeMinutes: r.downtimeMinutes != null ? Number(r.downtimeMinutes) : null,
    efficiencyScore: r.efficiencyScore != null ? Number(r.efficiencyScore) : null,
  }));
}

// Gap 4: Efficiency distribution with relationship to maintenance/defects
export async function getMachinesEfficiencyDistribution() {
  const rows = await query(`
    WITH per_machine AS (
      SELECT machine_id, MODE(efficiency_status) AS status,
        AVG(maintenance_risk) AS avg_maint, AVG(defect_rate) AS avg_defect,
        AVG(efficiency_score) AS avg_eff
      FROM machines_harmonized GROUP BY machine_id
    )
    SELECT status, COUNT(*) AS machine_count,
      AVG(avg_maint) AS avg_maintenance, AVG(avg_defect) AS avg_defect_rate,
      AVG(avg_eff) AS avg_efficiency_score
    FROM per_machine GROUP BY status ORDER BY AVG(avg_eff) DESC
  `);
  return rows.map((r) => ({
    status: String(r.status),
    machineCount: Number(r.machine_count),
    avgMaintenance: Math.round(Number(r.avg_maintenance || 0) * 1000) / 1000,
    avgDefectRate: Math.round(Number(r.avg_defect_rate || 0) * 100) / 100,
    avgEfficiencyScore: Math.round(Number(r.avg_efficiency_score || 0) * 10) / 10,
  }));
}

// Gap 6: Downtime alert log
export async function getMachinesDowntimeLog() {
  const rows = await query(`
    SELECT machine_id, machine_type, CAST(ts AS VARCHAR) AS timestamp,
      downtime_minutes, maintenance_flag, efficiency_score,
      vibration_raw AS vibration, temperature_raw AS temperature
    FROM machines_harmonized
    WHERE (downtime_minutes > 0 OR maintenance_flag = 1) AND source = 'iot'
    ORDER BY ts DESC LIMIT 100
  `);
  return rows.map((r) => ({
    machineId: String(r.machine_id),
    machineType: r.machine_type ? String(r.machine_type) : null,
    timestamp: String(r.timestamp),
    downtimeMinutes: Number(r.downtime_minutes || 0),
    maintenanceFlag: Number(r.maintenance_flag),
    efficiencyScore: Math.round(Number(r.efficiency_score || 0) * 10) / 10,
    vibration: Math.round(Number(r.vibration || 0) * 100) / 100,
    temperature: Math.round(Number(r.temperature || 0) * 10) / 10,
  }));
}

// Gap 7: Correlation analysis between 6G network and operational metrics
export async function getMachinesCorrelations() {
  const [row] = await query(`
    SELECT
      CORR(network_latency, error_rate_pct) AS latency_vs_error,
      CORR(network_latency, efficiency_score) AS latency_vs_efficiency,
      CORR(network_latency, production_speed) AS latency_vs_speed,
      CORR(packet_loss, error_rate_pct) AS packetloss_vs_error,
      CORR(packet_loss, efficiency_score) AS packetloss_vs_efficiency,
      CORR(packet_loss, defect_rate) AS packetloss_vs_defect,
      CORR(maintenance_risk, error_rate_pct) AS maintenance_vs_error,
      CORR(maintenance_risk, efficiency_score) AS maintenance_vs_efficiency,
      CORR(vibration_raw, maintenance_risk) AS vibration_vs_maintenance,
      CORR(temperature_raw, maintenance_risk) AS temp_vs_maintenance
    FROM machines_harmonized
    WHERE network_latency IS NOT NULL
  `);
  const round = (v: unknown) => v != null ? Math.round(Number(v) * 1000) / 1000 : 0;
  return {
    pairs: [
      { x: "Latency", y: "Error Rate", value: round(row.latency_vs_error) },
      { x: "Latency", y: "Efficiency", value: round(row.latency_vs_efficiency) },
      { x: "Latency", y: "Prod Speed", value: round(row.latency_vs_speed) },
      { x: "Pkt Loss", y: "Error Rate", value: round(row.packetloss_vs_error) },
      { x: "Pkt Loss", y: "Efficiency", value: round(row.packetloss_vs_efficiency) },
      { x: "Pkt Loss", y: "Defect Rate", value: round(row.packetloss_vs_defect) },
      { x: "Maint Risk", y: "Error Rate", value: round(row.maintenance_vs_error) },
      { x: "Maint Risk", y: "Efficiency", value: round(row.maintenance_vs_efficiency) },
      { x: "Vibration", y: "Maint Risk", value: round(row.vibration_vs_maintenance) },
      { x: "Temperature", y: "Maint Risk", value: round(row.temp_vs_maintenance) },
    ],
  };
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
