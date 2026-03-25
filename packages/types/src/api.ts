import type {
  DataSource,
  EfficiencyStatus,
  EventType,
  HarmonizedMachine,
  MachinePrediction,
  RiskLevel,
  ScheduleWarning,
  TeamPrediction,
  WorkOrder,
} from "./models.js";

// ── Health ──

export interface HealthResponse {
  status: string;
  tables: {
    workers: number;
    manufacturing: number;
    iot: number;
  };
}

// ── Workers ──

export interface WorkersSummaryResponse {
  totalWorkers: number;
  activeToday: number;
  attendanceRate: number;
  avgEfficacy: number;
  attritionCount: number;
  eventBreakdown: Record<EventType, number>;
}

export interface WorkersTimeseriesPoint {
  date: string;
  [key: string]: number | string; // EventType counts + date
}

export interface WorkersHeatmapCell {
  team: string;
  shift: string;
  values: Array<{ date: string; value: number }>;
}

export interface AttritionPoint {
  date: string;
  resignations: number;
  terminations: number;
  cumulative: number;
}

// ── Machines ──

export interface MachinesSummaryResponse {
  totalMachines: number;
  activeCount: number;
  avgEfficiency: number;
  riskDistribution: Record<RiskLevel, number>;
}

export interface MachineTimeseriesPoint {
  timestamp: string;
  machineId: string;
  temperature: number | null;
  vibration: number | null;
  power: number | null;
  errorRate: number | null;
  networkLatency: number | null;
  packetLoss: number | null;
}

export interface MachineRiskEntry {
  machineId: string;
  source: DataSource;
  riskLevel: RiskLevel;
  maintenanceScore: number;
  avgTemp: number;
  avgVibration: number;
}

// ── Schedule ──

export interface SchedulePredictionsResponse {
  days: Array<{
    date: string;
    weekday: string;
    teams: TeamPrediction[];
    machines: MachinePrediction[];
  }>;
}

export interface ScheduleOrdersResponse {
  orders: WorkOrder[];
}

export interface AssignRequest {
  orderId: string;
  team: string;
  shift: string;
  machineId: string;
  day: string;
}

export interface AssignResponse {
  success: boolean;
  warnings: ScheduleWarning[];
}
