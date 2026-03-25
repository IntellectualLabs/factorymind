import { useState, useMemo } from "react";
import type { DataSource } from "@factorymind/types";
import {
  useMachinesSummary,
  useMachinesTimeseries,
  useMachinesRisk,
  useHarmonizedMachines,
} from "@/api/client";
import MetricCard from "@/components/shared/MetricCard";
import LoadingState from "@/components/shared/LoadingState";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import DataTable from "@/components/tables/DataTable";
import { Cpu, Activity, AlertTriangle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { HarmonizedMachine, MachineRiskEntry } from "@factorymind/types";

const SOURCES: { label: string; value: DataSource }[] = [
  { label: "Manufacturing", value: "manufacturing" },
  { label: "IoT Sensors", value: "iot" },
  { label: "Harmonized", value: "harmonized" },
];

const riskColumns: ColumnDef<MachineRiskEntry, unknown>[] = [
  { accessorKey: "machineId", header: "Machine" },
  { accessorKey: "source", header: "Source" },
  {
    accessorKey: "riskLevel",
    header: "Risk",
    cell: ({ getValue }) => {
      const level = getValue() as string;
      return (
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            level === "high" && "bg-red-500/20 text-red-400",
            level === "medium" && "bg-amber-500/20 text-amber-400",
            level === "low" && "bg-emerald-500/20 text-emerald-400"
          )}
        >
          {level}
        </span>
      );
    },
  },
  {
    accessorKey: "maintenanceScore",
    header: "Maint. Score",
    cell: ({ getValue }) => (getValue() as number).toFixed(3),
  },
  {
    accessorKey: "avgTemp",
    header: "Avg Temp (C)",
    cell: ({ getValue }) => (getValue() as number).toFixed(1),
  },
  {
    accessorKey: "avgVibration",
    header: "Avg Vibration",
    cell: ({ getValue }) => (getValue() as number).toFixed(2),
  },
];

const harmonizedColumns: ColumnDef<HarmonizedMachine, unknown>[] = [
  { accessorKey: "machineId", header: "Machine" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "machineType", header: "Type" },
  {
    accessorKey: "tempNormalized",
    header: "Temp (norm)",
    cell: ({ getValue }) => (getValue() as number).toFixed(3),
  },
  {
    accessorKey: "vibrationNormalized",
    header: "Vibration (norm)",
    cell: ({ getValue }) => (getValue() as number).toFixed(3),
  },
  {
    accessorKey: "powerNormalized",
    header: "Power (norm)",
    cell: ({ getValue }) => (getValue() as number).toFixed(3),
  },
  { accessorKey: "efficiencyStatus", header: "Efficiency" },
  {
    accessorKey: "riskLevel",
    header: "Risk",
    cell: ({ getValue }) => {
      const level = getValue() as string;
      return (
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            level === "high" && "bg-red-500/20 text-red-400",
            level === "medium" && "bg-amber-500/20 text-amber-400",
            level === "low" && "bg-emerald-500/20 text-emerald-400"
          )}
        >
          {level}
        </span>
      );
    },
  },
];

export default function MachineDashboard() {
  const [source, setSource] = useState<DataSource>("harmonized");
  const [selectedMachine, setSelectedMachine] = useState<string>("");

  const { data: summary, isLoading } = useMachinesSummary(source);
  const { data: timeseries } = useMachinesTimeseries({
    source,
    machineId: selectedMachine || undefined,
    granularity: source === "iot" ? "minute" : "hour",
  });
  const { data: riskData } = useMachinesRisk();
  const { data: harmonized } = useHarmonizedMachines();

  // Get unique machine IDs from risk data for the filter
  const machineIds = useMemo(() => {
    if (!riskData) return [];
    return riskData
      .filter((m) => source === "harmonized" || m.source === source)
      .map((m) => m.machineId);
  }, [riskData, source]);

  // Default to first machine if none selected
  const effectiveMachine = selectedMachine || machineIds[0] || "";

  // Filter timeseries to selected machine for cleaner display
  const filteredTimeseries = useMemo(() => {
    if (!timeseries) return [];
    if (effectiveMachine) {
      return timeseries.filter((t) => t.machineId === effectiveMachine);
    }
    return timeseries.slice(0, 200);
  }, [timeseries, effectiveMachine]);

  // Format timestamps for display
  const formattedTimeseries = useMemo(() => {
    return filteredTimeseries.map((t) => ({
      ...t,
      timestamp: t.timestamp.includes(" ")
        ? t.timestamp.split(" ")[1]?.slice(0, 5) || t.timestamp.slice(11, 16)
        : t.timestamp.slice(11, 16),
    }));
  }, [filteredTimeseries]);

  if (isLoading) return <LoadingState message="Loading machine data..." />;

  // Top 10 risk machines for ranked list
  const topRisk = riskData?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Machine Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">
            Sensor monitoring, harmonized view, and maintenance risk
          </p>
        </div>
      </div>

      {/* Source Toggle */}
      <div className="flex gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              setSource(s.value);
              setSelectedMachine("");
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              source === s.value
                ? "bg-primary-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Machines" value={summary.totalMachines} icon={Cpu} />
          <MetricCard label="Active" value={summary.activeCount} icon={Activity} />
          <MetricCard
            label="Avg Efficiency"
            value={`${summary.avgEfficiency.toFixed(1)}%`}
            icon={Gauge}
          />
          <MetricCard
            label="High Risk Machines"
            value={`${summary.riskDistribution.high} of ${summary.totalMachines}`}
            icon={AlertTriangle}
          />
        </div>
      )}

      {/* Top Maintenance Risk — ranked list replacing useless gauges */}
      {topRisk.length > 0 && (
        <div className="bg-factory-card border border-factory-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Top Maintenance Risk</h3>
          <div className="space-y-2">
            {topRisk.map((m, i) => (
              <div
                key={m.machineId}
                className="flex items-center gap-3 group cursor-pointer hover:bg-slate-800/50 rounded-lg px-3 py-2 -mx-3"
                onClick={() => setSelectedMachine(m.machineId)}
              >
                <span className="text-xs text-slate-500 w-5 text-right">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-200">
                      Machine {m.machineId}
                      <span className="text-xs text-slate-500 ml-2">{m.source}</span>
                    </span>
                    <span className="text-sm font-mono text-slate-300">
                      {(m.maintenanceScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        m.riskLevel === "high" ? "bg-red-500" :
                        m.riskLevel === "medium" ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${m.maintenanceScore * 100}%` }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium",
                    m.riskLevel === "high" && "bg-red-500/20 text-red-400",
                    m.riskLevel === "medium" && "bg-amber-500/20 text-amber-400",
                    m.riskLevel === "low" && "bg-emerald-500/20 text-emerald-400"
                  )}
                >
                  {m.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensor Timeseries — with machine selector */}
      <div className="bg-factory-card border border-factory-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-300">Sensor Metrics Over Time</h3>
          <select
            value={effectiveMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="bg-slate-800 border border-factory-border rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {machineIds.map((id) => (
              <option key={id} value={id}>
                Machine {id}
              </option>
            ))}
          </select>
        </div>
        {formattedTimeseries.length > 0 ? (
          <TimeSeriesChart
            data={formattedTimeseries}
            xKey="timestamp"
            yKeys={["temperature", "vibration", "power"]}
            height={320}
          />
        ) : (
          <div className="h-[320px] flex items-center justify-center text-slate-500 text-sm">
            Select a machine to view sensor data
          </div>
        )}
      </div>

      {/* Risk Table */}
      {riskData && (
        <DataTable
          data={riskData.slice(0, 15)}
          columns={riskColumns}
          title={`Machine Risk Assessment (top 15 of ${riskData.length})`}
        />
      )}

      {/* Harmonized View */}
      {source === "harmonized" && harmonized && (
        <DataTable data={harmonized} columns={harmonizedColumns} title="Harmonized Machine View" />
      )}
    </div>
  );
}
