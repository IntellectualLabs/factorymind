import { useState, useMemo } from "react";
import {
  useWorkersSummary,
  useWorkersTimeseries,
  useWorkersHeatmap,
  useWorkersAttrition,
  useWorkersEfficacyAccuracy,
  useWorkersAttritionCauses,
  type WorkerFilters,
} from "@/api/client";
import MetricCard from "@/components/shared/MetricCard";
import FilterBar from "@/components/shared/FilterBar";
import LoadingState from "@/components/shared/LoadingState";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import BarChart from "@/components/charts/BarChart";
import HeatmapGrid from "@/components/charts/HeatmapGrid";
import { Users, UserCheck, TrendingUp, UserMinus, Target } from "lucide-react";
import { formatPercent } from "@/lib/utils";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const TEAMS = Array.from({ length: 24 }, (_, i) => ({
  label: `Team ${i + 1}`,
  value: `Team ${i + 1}`,
}));

const SHIFTS = [
  { label: "Shift 1", value: "Shift 1" },
  { label: "Shift 2", value: "Shift 2" },
  { label: "Shift 3", value: "Shift 3" },
];

const ATTENDANCE_COLORS = ["#22c55e", "#ef4444"];

export default function WorkforceDashboard() {
  const [filters, setFilters] = useState<WorkerFilters>({});

  const { data: summary, isLoading: summaryLoading } = useWorkersSummary(filters);
  const { data: timeseries } = useWorkersTimeseries({
    ...filters,
    granularity: "week",
  });
  const { data: heatmap } = useWorkersHeatmap({ ...filters, metric: "attendance" });
  const { data: attrition } = useWorkersAttrition(filters);
  const { data: efficacyAccuracy } = useWorkersEfficacyAccuracy(filters);
  const { data: attritionCauses } = useWorkersAttritionCauses(filters);

  // Pivot attrition causes for stacked bar chart
  const attritionCausesData = useMemo(() => {
    if (!attritionCauses) return [];
    const byCause: Record<string, { cause: string; Resignation: number; Termination: number }> = {};
    for (const entry of attritionCauses) {
      if (!byCause[entry.cause]) {
        byCause[entry.cause] = { cause: entry.cause, Resignation: 0, Termination: 0 };
      }
      if (entry.eventType === "Resignation") byCause[entry.cause].Resignation = entry.count;
      if (entry.eventType === "Termination") byCause[entry.cause].Termination = entry.count;
    }
    return Object.values(byCause).sort((a, b) => (b.Resignation + b.Termination) - (a.Resignation + a.Termination));
  }, [attritionCauses]);

  if (summaryLoading) return <LoadingState message="Loading workforce data..." />;

  // Prepare attendance donut data
  const attendanceData = summary
    ? [
        { name: "Present", value: summary.eventBreakdown.Presence },
        { name: "Absent", value: summary.eventBreakdown.Absence },
      ]
    : [];

  // Prepare special events bar data
  const specialEventsData = summary
    ? [
        { name: "Feats", count: summary.eventBreakdown.Feat },
        { name: "Slips", count: summary.eventBreakdown.Slip },
        { name: "Ideas", count: summary.eventBreakdown.Idea },
        { name: "Lapses", count: summary.eventBreakdown.Lapse },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Workforce Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">
            Daily performance and attrition tracking across {summary?.totalWorkers || 0} workers
          </p>
        </div>
      </div>

      <FilterBar
        filters={[
          {
            key: "team",
            label: "Team",
            options: TEAMS,
            value: filters.team || "",
            onChange: (v) => setFilters((f) => ({ ...f, team: v || undefined })),
          },
          {
            key: "shift",
            label: "Shift",
            options: SHIFTS,
            value: filters.shift || "",
            onChange: (v) => setFilters((f) => ({ ...f, shift: v || undefined })),
          },
        ]}
      />

      {/* KPI Cards — 5 cards including Supervisor Accuracy */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Total Workers"
            value={summary.totalWorkers}
            icon={Users}
          />
          <MetricCard
            label="Attendance Rate"
            value={formatPercent(summary.attendanceRate)}
            icon={UserCheck}
          />
          <MetricCard
            label="Avg Efficacy"
            value={summary.avgEfficacy.toFixed(2)}
            icon={TrendingUp}
          />
          <MetricCard
            label="Total Attrition"
            value={summary.attritionCount}
            icon={UserMinus}
          />
          {efficacyAccuracy && (
            <MetricCard
              label="Supervisor Accuracy"
              value={`${((1 - efficacyAccuracy.meanAbsError) * 100).toFixed(0)}%`}
              icon={Target}
              trend={{
                value: Math.round(efficacyAccuracy.correlation * 100),
                label: "correlation",
              }}
            />
          )}
        </div>
      )}

      {/* Efficacy Accuracy: Actual vs Recorded Distribution (Gap 1) */}
      {efficacyAccuracy && efficacyAccuracy.distribution.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChart
            data={efficacyAccuracy.distribution}
            xKey="bucket"
            yKeys={["count"]}
            title="Supervisor Efficacy Error Distribution (Actual - Recorded)"
            height={260}
          />
          <div className="bg-factory-card border border-factory-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Efficacy Comparison</h3>
            <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Avg Actual Efficacy</span>
                <span className="text-lg font-mono text-emerald-400">{efficacyAccuracy.avgActual.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Avg Recorded Efficacy</span>
                <span className="text-lg font-mono text-blue-400">{efficacyAccuracy.avgRecorded.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Mean Absolute Error</span>
                <span className="text-lg font-mono text-amber-400">{efficacyAccuracy.meanAbsError.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Correlation (r)</span>
                <span className="text-lg font-mono text-primary-400">{efficacyAccuracy.correlation.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Sample Size</span>
                <span className="text-lg font-mono text-slate-300">{efficacyAccuracy.sampleCount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Breakdown — split into Attendance donut + Special Events bars */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-factory-card border border-factory-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Attendance Ratio</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {attendanceData.map((_, i) => (
                    <Cell key={i} fill={ATTENDANCE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                  }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-slate-500 mt-1">
              {formatPercent(summary.attendanceRate)} attendance over the period
            </p>
          </div>
          <BarChart
            data={specialEventsData}
            xKey="name"
            yKeys={["count"]}
            title="Special Events"
            height={260}
          />
        </div>
      )}

      {/* Weekly Trends */}
      {timeseries && (
        <TimeSeriesChart
          data={timeseries}
          xKey="date"
          yKeys={["Absence", "Feat", "Slip", "Idea", "Lapse"]}
          title="Weekly Absence & Special Event Trends"
          height={350}
        />
      )}

      {/* Heatmap */}
      {heatmap && (
        <HeatmapGrid data={heatmap} title="Team Attendance Heatmap" colorScale="green" />
      )}

      {/* Attrition Timeline */}
      {attrition && attrition.length > 0 && (
        <TimeSeriesChart
          data={attrition}
          xKey="date"
          yKeys={["resignations", "terminations", "cumulative"]}
          title="Attrition Timeline"
          height={280}
        />
      )}

      {/* Attrition Cause Breakdown (Gap 2) */}
      {attritionCausesData.length > 0 && (
        <BarChart
          data={attritionCausesData}
          xKey="cause"
          yKeys={["Resignation", "Termination"]}
          title="Attrition by Cause"
          stacked
          height={300}
        />
      )}
    </div>
  );
}
