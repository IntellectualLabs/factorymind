// ── Workers (Dataset A) ──

export interface Worker {
  subId: number;
  firstName: string;
  lastName: string;
  age: number;
  sex: "M" | "F";
  shift: string;
  team: string;
  role: string;
  healthScore: number;
  commitmentScore: number;
  perceptivenessScore: number;
  dexterityScore: number;
}

export type EventType =
  | "Presence"
  | "Absence"
  | "Efficacy"
  | "Feat"
  | "Slip"
  | "Idea"
  | "Lapse"
  | "Resignation"
  | "Termination";

export interface WorkerEvent {
  date: string;
  eventType: EventType;
  team: string;
  shift: string;
  actualEfficacy: number | null;
  recordedEfficacy: number | null;
}

// ── Machines (Datasets B & C) ──

export type DataSource = "manufacturing" | "iot" | "harmonized";

export type EfficiencyStatus = "High" | "Medium" | "Low";

export type RiskLevel = "high" | "medium" | "low";

export interface Machine {
  machineId: string;
  source: DataSource;
  machineType: string | null;
  operationMode: string | null;
}

export interface MachineMetrics {
  machineId: string;
  source: DataSource;
  temperature: number;
  vibration: number;
  power: number;
  errorRate: number;
  efficiencyStatus: EfficiencyStatus;
  efficiencyScore: number;
  maintenanceRisk: number;
  networkLatency: number | null;
  packetLoss: number | null;
  cycleTime: number | null;
  downtimeMinutes: number | null;
}

export interface HarmonizedMachine {
  machineId: string;
  source: DataSource;
  machineType: string | null;
  tempNormalized: number;
  vibrationNormalized: number;
  powerNormalized: number;
  errorRatePct: number;
  efficiencyStatus: EfficiencyStatus;
  efficiencyScore: number;
  maintenanceRisk: number;
  riskLevel: RiskLevel;
}

// ── Scheduling ──

export interface WorkOrder {
  id: string;
  description: string;
  crewNeeded: number;
  machineType: string;
  priority: "high" | "medium" | "low";
  assignedTeam: string | null;
  assignedShift: string | null;
  assignedMachineId: string | null;
  assignedDay: string | null;
}

export interface TeamPrediction {
  team: string;
  shift: string;
  predictedAttendance: number;
  predictedEfficacy: number;
  confidence: number;
  totalWorkers: number;
  predictedAvailable: number;
}

export interface MachinePrediction {
  machineId: string;
  machineType: string | null;
  source: string;
  riskLevel: RiskLevel;
  maintenanceScore: number;
  recommendedLoad: "heavy" | "normal" | "light" | "avoid";
  avgTemp: number;
  avgVibration: number;
}

export interface ScheduleWarning {
  type: "low_attendance" | "maintenance_risk" | "capacity_exceeded";
  severity: "error" | "warning" | "info";
  message: string;
}

// ── Command Center Predictions ──

export type AlertSeverity = "critical" | "warning" | "info";

export interface PredictionAlert {
  id: string;
  severity: AlertSeverity;
  source: "machine" | "attendance";
  entity: string;
  metric: number;
  message: string;
  day: string;
}

export interface PredictionSummary {
  tomorrowAttendance: number;
  attendanceConf: number;
  machinesAtRisk: number;
  workforceCapacity: number;
  totalWorkers: number;
  openActions: number;
}

export interface RecommendedAction {
  id: string;
  severity: AlertSeverity;
  category: "maintenance" | "staffing" | "monitoring";
  title: string;
  description: string;
  entity: string;
  metric: number;
  day: string;
  navigateTo: string;
}
