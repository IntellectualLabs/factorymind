import { useMemo } from "react";
import { useNavigate } from "react-router";
import { usePredictions, useSchedulePredictions } from "@/api/client";
import MetricCard from "@/components/shared/MetricCard";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { cn, formatPercent } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Wrench,
  Users,
  ChevronRight,
  Shield,
  Activity,
  Eye,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { PredictionAlert, RecommendedAction } from "@factorymind/types";

function computeWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

const SEVERITY_BG: Record<string, { bg: string; border: string; text: string; muted: string }> = {
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-300", muted: "text-red-400/70" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300", muted: "text-amber-400/70" },
};

const CATEGORY_ICONS: Record<string, typeof Wrench> = {
  maintenance: Wrench,
  staffing: Users,
  monitoring: Eye,
};

// ── Alert Banner ──

function AlertBanner({
  alerts,
  isError,
  onRetry,
}: {
  alerts: PredictionAlert[];
  isError: boolean;
  onRetry?: () => void;
}) {
  if (isError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <p className="text-sm text-red-300 flex-1">Unable to check system status</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  if (critical.length === 0 && warnings.length === 0) {
    return (
      <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-300">All Systems Nominal</p>
          <p className="text-xs text-emerald-400/60">No predicted issues in the next 7 days</p>
        </div>
      </div>
    );
  }

  // Show criticals first; if none, show warnings as the primary alert
  const primary = critical.length > 0 ? critical : warnings;
  const severity = critical.length > 0 ? "critical" : "warning";
  const style = SEVERITY_BG[severity];
  const topAlerts = primary.slice(0, 2);
  const totalCount = critical.length + warnings.length;
  const days = [...new Set(primary.map((a) => a.day))];
  const dayText = days.length === 1 ? days[0] : days.length <= 3 ? days.join(", ") : `${days.length} days`;

  return (
    <div className={cn(style.bg, "border", style.border, "rounded-xl p-4 flex items-center gap-3")}>
      <AlertTriangle className={cn("w-5 h-5 flex-shrink-0", severity === "critical" ? "text-red-400" : "text-amber-400")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", style.text)}>
          {primary.length} {severity} prediction{primary.length !== 1 ? "s" : ""} for {dayText}
        </p>
        {topAlerts.map((a) => (
          <p key={a.id} className={cn("text-xs truncate mt-0.5", style.muted)}>
            {a.message}
          </p>
        ))}
        {totalCount > 2 && (
          <p className={cn("text-xs mt-1 opacity-60", style.muted)}>
            +{totalCount - 2} more alert{totalCount - 2 !== 1 ? "s" : ""}
          </p>
        )}
      </div>
      {warnings.length > 0 && critical.length > 0 && (
        <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-2 py-1 rounded-lg flex-shrink-0">
          +{warnings.length} warning{warnings.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

// ── Machine Risk Chart ──

function MachineRiskChart({ alerts }: { alerts: PredictionAlert[] }) {
  const machineAlerts = useMemo(
    () =>
      alerts
        .filter((a) => a.source === "machine")
        .sort((a, b) => b.metric - a.metric)
        .slice(0, 10),
    [alerts]
  );

  if (machineAlerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-center">
        <div>
          <Shield className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No machines at elevated risk</p>
        </div>
      </div>
    );
  }

  const data = machineAlerts.map((a) => {
    // Short label: "M001 Drill" or "#27"
    const rawLabel = a.message.split(" — ")[0] || a.entity;
    const shortLabel = rawLabel.replace("Machine #", "#").replace("Machine ", "");
    return {
      name: shortLabel,
      score: Math.round(a.metric * 100),
      severity: a.severity,
      // Extract just the causal metrics, drop redundant "risk X%"
      detail: (a.message.split(" — ")[1] || "").replace(/\s*\(risk \d+%\)/, ""),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: -10, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: "#cbd5e1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#e2e8f0", fontSize: 12, fontWeight: 500 }}
          width={55}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8, fontSize: 13, color: "#f1f5f9", maxWidth: 300, padding: "10px 14px" }}
          labelStyle={{ color: "#f8fafc", fontWeight: 700, fontSize: 14, marginBottom: 6 }}
          itemStyle={{ color: "#e2e8f0" }}
          formatter={(value: number, _name: string, props: { payload?: { detail?: string } }) => {
            const detail = props.payload?.detail;
            return [detail ? `Risk ${value}% · ${detail}` : `Risk ${value}%`, null];
          }}
          separator=""
          cursor={{ fill: "rgba(148, 163, 184, 0.05)" }}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((entry, i) => (
            <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || "#3b82f6"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Attendance Forecast Chart ──

function AttendanceForecastChart({ weekStart }: { weekStart: string }) {
  const { data: predictions, isLoading, isError } = useSchedulePredictions(weekStart);

  const chartData = useMemo(() => {
    if (!predictions?.days) return [];
    return predictions.days.map((day) => {
      const rates = day.teams.map((t) => t.predictedAttendance);
      const confs = day.teams.map((t) => t.confidence);
      const avgRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0.85;
      const avgConf = confs.length > 0 ? confs.reduce((s, c) => s + c, 0) / confs.length : 0.8;
      const stddev = (1 - avgConf) / 1.5;

      return {
        weekday: day.weekday.slice(0, 3),
        attendance: Math.round(avgRate * 1000) / 10,
        upper: Math.round(Math.min((avgRate + stddev) * 1000, 1000)) / 10,
        lower: Math.round(Math.max((avgRate - stddev) * 1000, 0)) / 10,
      };
    });
  }, [predictions]);

  if (isLoading) return <LoadingState message="Loading forecast..." />;
  if (isError) return <p className="text-sm text-slate-500 text-center py-8">Chart unavailable</p>;
  if (chartData.length === 0) return <p className="text-sm text-slate-500 text-center py-8">Insufficient data for forecast</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="weekday" tick={{ fill: "#e2e8f0", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
        <YAxis
          domain={[50, 100]}
          tick={{ fill: "#cbd5e1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8, fontSize: 13, color: "#f1f5f9", padding: "10px 14px" }}
          labelStyle={{ color: "#f8fafc", fontWeight: 700, fontSize: 14, marginBottom: 6 }}
          itemStyle={{ color: "#e2e8f0" }}
          formatter={(value: number, name: string) => {
            const label = name === "attendance" ? "Predicted" : name === "upper" ? "Upper bound" : "Lower bound";
            return [`${value}%`, label];
          }}
        />
        <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="6 3" strokeOpacity={0.5} />
        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="6 3" strokeOpacity={0.5} />
        <Area type="monotone" dataKey="upper" stroke="#3b82f6" strokeWidth={0} fill="url(#bandGradient)" />
        <Area type="monotone" dataKey="lower" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.3} fill="none" />
        <Area
          type="monotone"
          dataKey="attendance"
          stroke="#3b82f6"
          strokeWidth={2.5}
          fill="url(#attendanceGradient)"
          dot={{ fill: "#3b82f6", r: 4, strokeWidth: 2, stroke: "#0f172a" }}
          activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2, fill: "#0f172a" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Actions List ──

function ActionCard({ action, index }: { action: RecommendedAction; index: number }) {
  const navigate = useNavigate();
  const Icon = CATEGORY_ICONS[action.category] || Activity;
  const severityColor = SEVERITY_COLORS[action.severity] || "#3b82f6";

  return (
    <button
      onClick={() => navigate(action.navigateTo)}
      className="w-full text-left hover:bg-slate-700/30 border border-transparent hover:border-factory-border rounded-lg p-3 transition-all group flex items-start gap-3"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: severityColor, boxShadow: `0 0 8px ${severityColor}40` }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-200">{action.title}</span>
        </div>
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{action.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {action.entity}
          </span>
          <span className="text-[10px] text-slate-600">{action.day}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all mt-1 flex-shrink-0" />
    </button>
  );
}

// ── Main Command Center ──

export default function CommandCenter() {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = usePredictions();
  const weekStart = useMemo(() => computeWeekStart(new Date()), []);

  if (isLoading) {
    return <LoadingState message="Loading predictions..." />;
  }

  const alerts = data?.alerts || [];
  const summary = data?.summary;
  const actions = data?.actions || [];

  // Stale data indicator
  const updatedAgo = dataUpdatedAt
    ? Math.round((Date.now() - dataUpdatedAt) / 60_000)
    : null;
  const isStale = updatedAgo !== null && updatedAgo > 5;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Command Center</h2>
          <p className="text-sm text-slate-500 mt-1">
            Next 7 days{" "}
            {updatedAgo !== null && (
              <>
                <span className="text-slate-600 mx-1">/</span>
                <span className={cn(isStale ? "text-amber-400" : "text-slate-500")}>
                  {updatedAgo < 1 ? "updated just now" : `updated ${updatedAgo}m ago`}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isError ? "bg-red-500" : "bg-emerald-500",
          )} />
          <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">
            {isError ? "Offline" : "Live"}
          </span>
        </div>
      </div>

      {/* Alert Banner */}
      <AlertBanner alerts={alerts} isError={isError} onRetry={refetch} />

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Workforce Capacity"
            value={`${summary.workforceCapacity}%`}
            icon={TrendingUp}
            trend={{ value: 0, label: `of ${summary.totalWorkers} workers` }}
          />
          <MetricCard
            label="Machines at Risk"
            value={summary.machinesAtRisk}
            icon={AlertTriangle}
            className={summary.machinesAtRisk > 0 ? "border-amber-500/20" : undefined}
          />
          <MetricCard
            label="Tomorrow Attendance"
            value={formatPercent(summary.tomorrowAttendance)}
            icon={Users}
          />
          <MetricCard
            label="Open Actions"
            value={summary.openActions}
            icon={Wrench}
          />
        </div>
      )}

      {isError && !data && <ErrorState message="Unable to load predictions" onRetry={refetch} />}

      {/* Recommended Actions — above charts for visibility */}
      {data && actions.length > 0 && (
        <div className="bg-factory-card border border-factory-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">
              Recommended Actions
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
              {actions.length}
            </span>
          </div>
          <div className="space-y-2">
            {actions.map((action, i) => (
              <ActionCard key={action.id} action={action} index={i} />
            ))}
          </div>
        </div>
      )}

      {data && actions.length === 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-500/50 flex-shrink-0" />
          <p className="text-xs text-emerald-400/60">No recommended actions — all operations within normal parameters</p>
        </div>
      )}

      {/* Charts: 2-column on large screens */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Machine Risk */}
          <div className="bg-factory-card border border-factory-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">Machine Risk — Top Concerns</h3>
              <span className="text-[10px] text-slate-600">
                {summary?.machinesAtRisk || 0} of {alerts.filter((a) => a.source === "machine").length + (summary?.machinesAtRisk || 0) - alerts.filter((a) => a.source === "machine").length} flagged
              </span>
            </div>
            <MachineRiskChart alerts={alerts} />
          </div>

          {/* Attendance Forecast */}
          <div className="bg-factory-card border border-factory-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">Attendance Forecast</h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 border-t border-dashed border-amber-500" /> 80%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 border-t border-dashed border-red-500" /> 70%
                </span>
              </div>
            </div>
            <AttendanceForecastChart weekStart={weekStart} />
          </div>
        </div>
      )}
    </div>
  );
}
