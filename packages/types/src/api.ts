import type {
  DataSource,
  EfficiencyStatus,
  EventType,
  HarmonizedMachine,
  MachinePrediction,
  PredictionAlert,
  PredictionSummary,
  RecommendedAction,
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

// ── Workers: Efficacy Accuracy (Gap 1) ──

export interface EfficacyAccuracyResponse {
  meanAbsError: number;
  correlation: number;
  avgActual: number;
  avgRecorded: number;
  sampleCount: number;
  distribution: Array<{ bucket: string; count: number }>;
}

// ── Workers: Attrition Causes (Gap 2) ──

export interface AttritionCauseEntry {
  cause: string;
  eventType: string;
  count: number;
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
  cycleTime: number | null;
  pressure: number | null;
  materialFlowRate: number | null;
  downtimeMinutes: number | null;
  efficiencyScore: number | null;
}

// ── Machines: Efficiency Distribution (Gap 4) ──

export interface EfficiencyDistributionEntry {
  status: string;
  machineCount: number;
  avgMaintenance: number;
  avgDefectRate: number;
  avgEfficiencyScore: number;
}

// ── Machines: Downtime Log (Gap 6) ──

export interface DowntimeLogEntry {
  machineId: string;
  machineType: string | null;
  timestamp: string;
  downtimeMinutes: number;
  maintenanceFlag: number;
  efficiencyScore: number;
  vibration: number;
  temperature: number;
}

// ── Machines: Correlations (Gap 7) ──

export interface CorrelationPair {
  x: string;
  y: string;
  value: number;
}

export interface CorrelationsResponse {
  pairs: CorrelationPair[];
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

// ── Predictions (Command Center) ──

export interface PredictionsResponse {
  alerts: PredictionAlert[];
  summary: PredictionSummary;
  actions: RecommendedAction[];
}
