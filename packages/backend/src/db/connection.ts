import duckdb from "duckdb";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../../data");

let db: duckdb.Database | null = null;
let conn: duckdb.Connection | null = null;

function runAsync(connection: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function allAsync(connection: duckdb.Connection, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    connection.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as Record<string, unknown>[]);
    });
  });
}

export async function getConnection(): Promise<duckdb.Connection> {
  if (conn) return conn;

  db = new duckdb.Database(":memory:");
  conn = new duckdb.Connection(db);

  await ingestData(conn);
  return conn;
}

async function ingestData(connection: duckdb.Connection) {
  const workersPath = path.join(DATA_DIR, "workers.csv").replace(/\\/g, "/");
  const manufacturingPath = path.join(DATA_DIR, "manufacturing.csv").replace(/\\/g, "/");
  const iotPath = path.join(DATA_DIR, "iot.csv").replace(/\\/g, "/");

  console.log("Loading workers.csv...");
  await runAsync(connection,
    `CREATE TABLE IF NOT EXISTS workers AS SELECT * FROM read_csv_auto('${workersPath}', ignore_errors=true)`
  );

  console.log("Loading manufacturing.csv...");
  await runAsync(connection,
    `CREATE TABLE IF NOT EXISTS manufacturing AS SELECT * FROM read_csv_auto('${manufacturingPath}')`
  );

  console.log("Loading iot.csv...");
  await runAsync(connection,
    `CREATE TABLE IF NOT EXISTS iot AS SELECT * FROM read_csv_auto('${iotPath}')`
  );

  console.log("Creating harmonized view...");
  await runAsync(connection, `
    CREATE OR REPLACE VIEW machines_harmonized AS
    SELECT
      'manufacturing' AS source,
      CAST("Machine_ID" AS VARCHAR) AS machine_id,
      NULL AS machine_type,
      "Operation_Mode" AS operation_mode,
      "Temperature_C" AS temperature_raw,
      (CAST("Temperature_C" AS DOUBLE) - 30.0) / (90.0 - 30.0) AS temp_normalized,
      "Vibration_Hz" AS vibration_raw,
      (CAST("Vibration_Hz" AS DOUBLE) - 0.3) / (4.8 - 0.3) AS vibration_normalized,
      "Power_Consumption_kW" AS power_raw,
      (CAST("Power_Consumption_kW" AS DOUBLE) - 1.9) / (10.0 - 1.9) AS power_normalized,
      "Error_Rate_%" AS error_rate_pct,
      "Efficiency_Status" AS efficiency_status,
      CASE "Efficiency_Status"
        WHEN 'High' THEN 85.0
        WHEN 'Medium' THEN 55.0
        ELSE 25.0
      END AS efficiency_score,
      "Predictive_Maintenance_Score" AS maintenance_risk,
      "Network_Latency_ms" AS network_latency,
      "Packet_Loss_%" AS packet_loss,
      "Production_Speed_units_per_hr" AS production_speed,
      "Quality_Control_Defect_Rate_%" AS defect_rate,
      NULL::DOUBLE AS pressure,
      NULL::DOUBLE AS material_flow_rate,
      NULL::DOUBLE AS cycle_time,
      NULL::DOUBLE AS downtime_minutes,
      NULL::INTEGER AS maintenance_flag,
      NULL::INTEGER AS production_status,
      "Timestamp" AS ts
    FROM manufacturing

    UNION ALL

    SELECT
      'iot' AS source,
      machine_id,
      machine_type,
      CASE WHEN production_status = 1 THEN 'Active' ELSE 'Idle' END AS operation_mode,
      temperature AS temperature_raw,
      (CAST(temperature AS DOUBLE) - 68.0) / (92.0 - 68.0) AS temp_normalized,
      vibration_level AS vibration_raw,
      (CAST(vibration_level AS DOUBLE) - 1.2) / (7.4 - 1.2) AS vibration_normalized,
      power_consumption AS power_raw,
      (CAST(power_consumption AS DOUBLE) - 15.0) / (28.0 - 15.0) AS power_normalized,
      error_rate * 100 AS error_rate_pct,
      CASE
        WHEN efficiency_score >= 70 THEN 'High'
        WHEN efficiency_score >= 30 THEN 'Medium'
        ELSE 'Low'
      END AS efficiency_status,
      CAST(efficiency_score AS DOUBLE) AS efficiency_score,
      CAST(maintenance_flag AS DOUBLE) AS maintenance_risk,
      NULL::DOUBLE AS network_latency,
      NULL::DOUBLE AS packet_loss,
      NULL::DOUBLE AS production_speed,
      NULL::DOUBLE AS defect_rate,
      pressure,
      material_flow_rate,
      cycle_time,
      CAST(downtime AS DOUBLE) AS downtime_minutes,
      maintenance_flag,
      production_status,
      timestamp AS ts
    FROM iot
  `);

  console.log("All data loaded successfully.");
}

export async function query(sql: string): Promise<Record<string, unknown>[]> {
  const connection = await getConnection();
  return allAsync(connection, sql);
}

export async function getTableCounts() {
  const [workers] = await query("SELECT COUNT(*) AS cnt FROM workers");
  const [manufacturing] = await query("SELECT COUNT(*) AS cnt FROM manufacturing");
  const [iot] = await query("SELECT COUNT(*) AS cnt FROM iot");
  return {
    workers: Number(workers.cnt),
    manufacturing: Number(manufacturing.cnt),
    iot: Number(iot.cnt),
  };
}
