import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  HealthResponse,
  WorkersSummaryResponse,
  WorkersTimeseriesPoint,
  WorkersHeatmapCell,
  AttritionPoint,
  EfficacyAccuracyResponse,
  AttritionCauseEntry,
  MachinesSummaryResponse,
  MachineTimeseriesPoint,
  MachineRiskEntry,
  HarmonizedMachine,
  EfficiencyDistributionEntry,
  DowntimeLogEntry,
  CorrelationsResponse,
  SchedulePredictionsResponse,
  ScheduleOrdersResponse,
  AssignRequest,
  AssignResponse,
  DataSource,
} from "@factorymind/types";

const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""
  );
  return entries.length > 0 ? `?${new URLSearchParams(entries)}` : "";
}

// ── Health ──

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => fetchJson<HealthResponse>("/health"),
  });
}

// ── Workers ──

export interface WorkerFilters {
  team?: string;
  shift?: string;
  from?: string;
  to?: string;
  granularity?: string;
  metric?: string;
}

export function useWorkersSummary(filters: WorkerFilters) {
  return useQuery({
    queryKey: ["workers", "summary", filters],
    queryFn: () =>
      fetchJson<WorkersSummaryResponse>(`/workers/summary${buildQuery(filters)}`),
  });
}

export function useWorkersTimeseries(filters: WorkerFilters) {
  return useQuery({
    queryKey: ["workers", "timeseries", filters],
    queryFn: () =>
      fetchJson<WorkersTimeseriesPoint[]>(`/workers/timeseries${buildQuery(filters)}`),
  });
}

export function useWorkersHeatmap(filters: WorkerFilters) {
  return useQuery({
    queryKey: ["workers", "heatmap", filters],
    queryFn: () =>
      fetchJson<WorkersHeatmapCell[]>(
        `/workers/heatmap${buildQuery({ metric: filters.metric, from: filters.from, to: filters.to })}`
      ),
  });
}

export function useWorkersAttrition(filters: WorkerFilters) {
  return useQuery({
    queryKey: ["workers", "attrition", filters],
    queryFn: () =>
      fetchJson<AttritionPoint[]>(
        `/workers/attrition${buildQuery({ from: filters.from, to: filters.to })}`
      ),
  });
}

export function useWorkersEfficacyAccuracy(filters: WorkerFilters) {
  return useQuery({
    queryKey: ["workers", "efficacy-accuracy", filters],
    queryFn: () =>
      fetchJson<EfficacyAccuracyResponse>(
        `/workers/efficacy-accuracy${buildQuery(filters)}`
      ),
  });
}

export function useWorkersAttritionCauses(filters: WorkerFilters) {
  return useQuery({
    queryKey: ["workers", "attrition-causes", filters],
    queryFn: () =>
      fetchJson<AttritionCauseEntry[]>(
        `/workers/attrition-causes${buildQuery(filters)}`
      ),
  });
}

// ── Machines ──

export interface MachineFilters {
  source?: DataSource;
  machineId?: string;
  metrics?: string;
  granularity?: string;
}

export function useMachinesSummary(source?: DataSource) {
  return useQuery({
    queryKey: ["machines", "summary", source],
    queryFn: () =>
      fetchJson<MachinesSummaryResponse>(`/machines/summary${buildQuery({ source })}`),
  });
}

export function useMachinesTimeseries(filters: MachineFilters) {
  return useQuery({
    queryKey: ["machines", "timeseries", filters],
    queryFn: () =>
      fetchJson<MachineTimeseriesPoint[]>(`/machines/timeseries${buildQuery(filters)}`),
  });
}

export function useMachinesRisk() {
  return useQuery({
    queryKey: ["machines", "risk"],
    queryFn: () => fetchJson<MachineRiskEntry[]>("/machines/risk"),
  });
}

export function useHarmonizedMachines() {
  return useQuery({
    queryKey: ["machines", "harmonized"],
    queryFn: () => fetchJson<HarmonizedMachine[]>("/machines/harmonized"),
  });
}

export function useMachinesEfficiencyDistribution() {
  return useQuery({
    queryKey: ["machines", "efficiency-distribution"],
    queryFn: () => fetchJson<EfficiencyDistributionEntry[]>("/machines/efficiency-distribution"),
  });
}

export function useMachinesDowntimeLog() {
  return useQuery({
    queryKey: ["machines", "downtime-log"],
    queryFn: () => fetchJson<DowntimeLogEntry[]>("/machines/downtime-log"),
  });
}

export function useMachinesCorrelations() {
  return useQuery({
    queryKey: ["machines", "correlations"],
    queryFn: () => fetchJson<CorrelationsResponse>("/machines/correlations"),
  });
}

// ── Schedule ──

export function useSchedulePredictions(weekStart: string) {
  return useQuery({
    queryKey: ["schedule", "predictions", weekStart],
    queryFn: () =>
      fetchJson<SchedulePredictionsResponse>(
        `/schedule/predictions${buildQuery({ weekStart })}`
      ),
  });
}

export function useScheduleOrders(weekStart: string) {
  return useQuery({
    queryKey: ["schedule", "orders", weekStart],
    queryFn: () =>
      fetchJson<ScheduleOrdersResponse>(
        `/schedule/orders${buildQuery({ weekStart })}`
      ),
  });
}

export function useAssignOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignRequest & { weekStart: string }) =>
      postJson<AssignResponse>("/schedule/assign", data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["schedule", "orders", variables.weekStart],
      });
    },
  });
}

export function useUnassignOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { orderId: string; weekStart: string }) =>
      postJson<{ success: boolean }>("/schedule/unassign", data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["schedule", "orders", variables.weekStart],
      });
    },
  });
}
