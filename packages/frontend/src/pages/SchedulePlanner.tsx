import { useState, useCallback, useMemo } from "react";
import {
  useSchedulePredictions,
  useScheduleOrders,
  useAssignOrder,
  useUnassignOrder,
} from "@/api/client";
import LoadingState from "@/components/shared/LoadingState";
import MetricCard from "@/components/shared/MetricCard";
import { cn, formatPercent } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { WorkOrder, ScheduleWarning, MachinePrediction } from "@factorymind/types";
import MachineSelectModal from "@/components/schedule/MachineSelectModal";
import {
  AlertTriangle,
  GripVertical,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Users,
  TrendingUp,
  Package,
  Search,
} from "lucide-react";

function computeWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().split("T")[0];
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} - ${fmt(end)}, ${start.getFullYear()}`;
}

const PRIORITY_COLORS = {
  high: { border: "border-l-red-500", bg: "bg-red-500/10", text: "text-red-400", label: "HIGH" },
  medium: { border: "border-l-amber-500", bg: "bg-amber-500/10", text: "text-amber-400", label: "MED" },
  low: { border: "border-l-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", label: "LOW" },
};

// ── Draggable Work Order Card ──

function WorkOrderCard({ order, isDragging }: { order: WorkOrder; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: order.id,
    data: order,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const prio = PRIORITY_COLORS[order.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-slate-700/80 border border-factory-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity",
        isDragging && "opacity-30",
        `border-l-4 ${prio.border}`
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-200 truncate">{order.id}</p>
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", prio.bg, prio.text)}>
              {prio.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">{order.description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3" /> {order.crewNeeded}
            </span>
            <span className="text-[10px] text-slate-500">{order.machineType}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Droppable Day Cell with Capacity Bar ──

function DayCell({
  day,
  weekday,
  team,
  shift,
  attendance,
  efficacy,
  predictedAvailable,
  assignedOrders,
  isWeekend,
  onUnassign,
}: {
  day: string;
  weekday: string;
  team: string;
  shift: string;
  attendance: number;
  efficacy: number;
  predictedAvailable: number;
  assignedOrders: WorkOrder[];
  isWeekend: boolean;
  onUnassign: (orderId: string) => void;
}) {
  const dropId = `${day}-${team}-${shift}`;
  const { isOver, setNodeRef } = useDroppable({ id: dropId, data: { day, team, shift } });

  const isEmpty = assignedOrders.length === 0;
  const totalCrewDemand = assignedOrders.reduce((sum, o) => sum + o.crewNeeded, 0);
  const capacityRatio = predictedAvailable > 0 ? totalCrewDemand / predictedAvailable : 0;
  const isOverloaded = capacityRatio > 1;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[140px] rounded-lg border p-2.5 transition-all flex flex-col",
        isOver
          ? "bg-primary-600/20 border-primary-500 border-solid shadow-lg shadow-primary-500/10"
          : isEmpty
            ? "border-dashed border-slate-600 hover:border-slate-500"
            : "border-factory-border border-solid",
        isWeekend ? "bg-slate-900/60" : isEmpty ? "bg-slate-800/30" : "bg-slate-800/50"
      )}
    >
      {/* Header: day label + badges */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn("text-xs font-medium", isWeekend ? "text-slate-500" : "text-slate-400")}>
          {weekday.slice(0, 3)}
        </span>
        <div className="flex gap-1">
          <span
            className={cn(
              "text-[9px] font-medium px-1 py-0.5 rounded",
              attendance >= 0.85
                ? "bg-emerald-500/20 text-emerald-400"
                : attendance >= 0.7
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-red-500/20 text-red-400"
            )}
          >
            {formatPercent(attendance)}
          </span>
          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">
            Eff {formatPercent(efficacy)}
          </span>
        </div>
      </div>

      {/* Capacity bar */}
      <div className="mb-2">
        <div className="h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOverloaded ? "bg-red-500" : capacityRatio > 0.7 ? "bg-amber-500" : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(capacityRatio * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-slate-500">{totalCrewDemand} / {predictedAvailable} crew</span>
          {isOverloaded && <span className="text-[8px] text-red-400 font-medium">OVER</span>}
        </div>
      </div>

      {/* Assigned orders */}
      <div className="flex-1 space-y-1">
        {assignedOrders.map((o) => {
          const prio = PRIORITY_COLORS[o.priority];
          return (
            <div
              key={o.id}
              className={cn(
                "text-[10px] rounded-md px-2 py-1 border flex items-center gap-1 group",
                `border-l-2 ${prio.border}`,
                "bg-primary-600/10 border-primary-500/15 text-primary-300"
              )}
            >
              <span className="font-semibold">{o.id}</span>
              <span className="text-primary-400/50 truncate flex-1">{o.description.split(" - ")[0]}</span>
              <span className="text-[8px] text-slate-500">{o.crewNeeded}</span>
              <button
                onClick={() => onUnassign(o.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity ml-0.5"
                title="Unassign"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {isEmpty && !isOver && (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <div className="text-center">
            <span className="text-lg leading-none">+</span>
            <p className="text-[9px] mt-0.5">Drop here</p>
          </div>
        </div>
      )}
      {isOver && isEmpty && (
        <div className="flex-1 flex items-center justify-center text-primary-400">
          <span className="text-xs font-medium">Release to assign</span>
        </div>
      )}
    </div>
  );
}

// ── Main Scheduler ──

interface PendingAssignment {
  orderId: string;
  orderType: string;
  day: string;
  team: string;
  shift: string;
}

type SortMode = "priority" | "crew" | "type";

export default function SchedulePlanner() {
  const [weekStart, setWeekStart] = useState(() => computeWeekStart(new Date()));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ScheduleWarning[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("Team 1");
  const [selectedShift, setSelectedShift] = useState("Shift 1");
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: predictions, isLoading: predsLoading } = useSchedulePredictions(weekStart);
  const { data: ordersData, isLoading: ordersLoading } = useScheduleOrders(weekStart);
  const assignMutation = useAssignOrder();
  const unassignMutation = useUnassignOrder();

  const orders = ordersData?.orders || [];
  const unassigned = useMemo(() => {
    let result = orders.filter((o) => !o.assignedDay);

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.machineType.toLowerCase().includes(q)
      );
    }

    // Sort
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (sortMode === "priority") {
      result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortMode === "crew") {
      result.sort((a, b) => b.crewNeeded - a.crewNeeded);
    } else {
      result.sort((a, b) => a.machineType.localeCompare(b.machineType));
    }

    return result;
  }, [orders, searchQuery, sortMode]);

  const assigned = orders.filter((o) => o.assignedDay);

  // Weekly KPI computations
  const weeklyKpis = useMemo(() => {
    const totalDemand = orders.reduce((sum, o) => sum + o.crewNeeded, 0);
    const assignedDemand = assigned.reduce((sum, o) => sum + o.crewNeeded, 0);
    const days = predictions?.days || [];
    const selectedTeamPreds = days.map((d) =>
      d.teams.find((t) => t.team === selectedTeam && t.shift === selectedShift)
    );
    const totalCapacity = selectedTeamPreds.reduce(
      (sum, p) => sum + (p?.predictedAvailable || 0),
      0
    );
    const avgEfficacy =
      selectedTeamPreds.length > 0
        ? selectedTeamPreds.reduce((sum, p) => sum + (p?.predictedEfficacy || 0), 0) /
          selectedTeamPreds.length
        : 0;

    return {
      totalDemand,
      assignedDemand,
      unassignedCount: unassigned.length,
      assignedCount: assigned.length,
      totalCapacity,
      utilization: totalCapacity > 0 ? assignedDemand / totalCapacity : 0,
      avgEfficacy,
    };
  }, [orders, assigned, unassigned, predictions, selectedTeam, selectedShift]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const dropData = over.data.current as { day: string; team: string; shift: string } | undefined;
      if (!dropData) return;

      const order = orders.find((o) => o.id === String(active.id));
      setPendingAssignment({
        orderId: String(active.id),
        orderType: order?.machineType || "General",
        day: dropData.day,
        team: dropData.team,
        shift: dropData.shift,
      });
    },
    [orders]
  );

  const handleMachineSelect = useCallback(
    async (machineId: string) => {
      if (!pendingAssignment) return;
      setPendingAssignment(null);
      try {
        const result = await assignMutation.mutateAsync({
          orderId: pendingAssignment.orderId,
          team: pendingAssignment.team,
          shift: pendingAssignment.shift,
          machineId,
          day: pendingAssignment.day,
          weekStart,
        });
        if (result.warnings.length > 0) {
          setWarnings((prev) => [...prev, ...result.warnings]);
          setTimeout(() => setWarnings([]), 5000);
        }
      } catch {
        setWarnings((prev) => [
          ...prev,
          { type: "capacity_exceeded" as const, severity: "error" as const, message: "Failed to assign work order. Please try again." },
        ]);
        setTimeout(() => setWarnings([]), 5000);
      }
    },
    [pendingAssignment, assignMutation, weekStart]
  );

  const handleUnassign = useCallback(
    async (orderId: string) => {
      try {
        await unassignMutation.mutateAsync({ orderId, weekStart });
      } catch {
        setWarnings((prev) => [
          ...prev,
          { type: "capacity_exceeded" as const, severity: "error" as const, message: "Failed to unassign. Please try again." },
        ]);
        setTimeout(() => setWarnings([]), 5000);
      }
    },
    [unassignMutation, weekStart]
  );

  if (predsLoading || ordersLoading) {
    return <LoadingState message="Loading schedule predictions..." />;
  }

  const days = predictions?.days || [];
  const machinePreds: MachinePrediction[] = days[0]?.machines || [];
  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-5">

        {/* ── Header with Week Navigation ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Schedule Planner</h2>
            <p className="text-sm text-slate-400 mt-1">
              Drag work orders to assign teams and machines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
              className="p-2 rounded-lg bg-slate-800 border border-factory-border text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-[180px]">
              <p className="text-sm font-medium text-white">{formatWeekRange(weekStart)}</p>
              <button
                onClick={() => setWeekStart(computeWeekStart(new Date()))}
                className="text-[10px] text-primary-400 hover:text-primary-300"
              >
                Today
              </button>
            </div>
            <button
              onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
              className="p-2 rounded-lg bg-slate-800 border border-factory-border text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Warnings ── */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm",
                  w.severity === "error"
                    ? "bg-red-500/15 text-red-300 border border-red-500/20"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                )}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {w.message}
                <button
                  onClick={() => setWarnings((p) => p.filter((_, idx) => idx !== i))}
                  className="ml-auto hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Weekly Summary KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Work Orders"
            value={`${weeklyKpis.assignedCount} / ${orders.length}`}
            icon={ClipboardList}
          />
          <MetricCard
            label="Crew Demand"
            value={`${weeklyKpis.assignedDemand} / ${weeklyKpis.totalDemand}`}
            icon={Package}
          />
          <MetricCard
            label={`${selectedTeam} Capacity`}
            value={`${weeklyKpis.totalCapacity} crew`}
            icon={Users}
          />
          <MetricCard
            label="Avg Efficacy"
            value={formatPercent(weeklyKpis.avgEfficacy)}
            icon={TrendingUp}
          />
        </div>

        {/* ── Utilization Bar ── */}
        <div className="bg-factory-card border border-factory-border rounded-xl px-5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Week Utilization ({selectedTeam}, {selectedShift})</span>
            <span className={cn(
              "text-xs font-mono font-medium",
              weeklyKpis.utilization > 1 ? "text-red-400" : weeklyKpis.utilization > 0.8 ? "text-amber-400" : "text-emerald-400"
            )}>
              {(weeklyKpis.utilization * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                weeklyKpis.utilization > 1 ? "bg-red-500" : weeklyKpis.utilization > 0.8 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(weeklyKpis.utilization * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* ── Team/Shift selectors ── */}
        <div className="flex gap-3 items-center">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-slate-800 border border-factory-border rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={`Team ${i + 1}`}>
                Team {i + 1}
              </option>
            ))}
          </select>
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="bg-slate-800 border border-factory-border rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Shift 1">Shift 1</option>
            <option value="Shift 2">Shift 2</option>
            <option value="Shift 3">Shift 3</option>
          </select>
        </div>

        {/* ── Main Layout: Sidebar + Grid ── */}
        <div className="flex gap-5">

          {/* ── Unassigned Work Orders Sidebar ── */}
          <div className="w-72 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-300">
                Unassigned ({unassigned.length})
              </h3>
            </div>

            {/* Search + Sort */}
            <div className="space-y-2 mb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-factory-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-1">
                {(["priority", "crew", "type"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded font-medium transition-colors",
                      sortMode === mode
                        ? "bg-primary-600/30 text-primary-300"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {mode === "priority" ? "Priority" : mode === "crew" ? "Crew Size" : "Type"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-auto pr-1">
              {unassigned.map((order) => (
                <WorkOrderCard
                  key={order.id}
                  order={order}
                  isDragging={activeId === order.id}
                />
              ))}
              {unassigned.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  {searchQuery ? "No matching orders" : "All orders assigned"}
                </div>
              )}
            </div>
          </div>

          {/* ── Week Grid ── */}
          <div className="flex-1">
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {days.map((day) => {
                const isWeekend = day.weekday === "Saturday" || day.weekday === "Sunday";
                return (
                  <div key={day.date} className="text-center pb-1">
                    <span className={cn(
                      "text-xs font-medium",
                      isWeekend ? "text-slate-500" : "text-slate-400"
                    )}>
                      {day.weekday.slice(0, 3)}
                    </span>
                    <p className="text-[10px] text-slate-500">{day.date.slice(5)}</p>
                  </div>
                );
              })}

              {/* Grid cells for selected team */}
              {days.map((day) => {
                const isWeekend = day.weekday === "Saturday" || day.weekday === "Sunday";
                const teamPred = day.teams.find(
                  (t) => t.team === selectedTeam && t.shift === selectedShift
                );
                const dayOrders = assigned.filter(
                  (o) =>
                    o.assignedDay === day.date &&
                    o.assignedTeam === selectedTeam &&
                    o.assignedShift === selectedShift
                );

                return (
                  <DayCell
                    key={`${day.date}-${selectedTeam}-${selectedShift}`}
                    day={day.date}
                    weekday={day.weekday}
                    team={selectedTeam}
                    shift={selectedShift}
                    attendance={teamPred?.predictedAttendance || 0.85}
                    efficacy={teamPred?.predictedEfficacy || 0.7}
                    predictedAvailable={teamPred?.predictedAvailable || 20}
                    assignedOrders={dayOrders}
                    isWeekend={isWeekend}
                    onUnassign={handleUnassign}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Drag Overlay (rich card) ── */}
      <DragOverlay>
        {activeOrder ? (
          <div className={cn(
            "bg-slate-700 border border-primary-500 rounded-lg p-3 shadow-2xl shadow-primary-500/20 w-64 opacity-95",
            `border-l-4 ${PRIORITY_COLORS[activeOrder.priority].border}`
          )}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{activeOrder.id}</p>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded",
                    PRIORITY_COLORS[activeOrder.priority].bg,
                    PRIORITY_COLORS[activeOrder.priority].text
                  )}>
                    {PRIORITY_COLORS[activeOrder.priority].label}
                  </span>
                </div>
                <p className="text-xs text-slate-300 truncate mt-0.5">{activeOrder.description}</p>
                <p className="text-[10px] text-slate-400 mt-1">Crew: {activeOrder.crewNeeded}</p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* ── Machine Selection Modal ── */}
      {pendingAssignment && (
        <MachineSelectModal
          machines={machinePreds}
          orderType={pendingAssignment.orderType}
          onSelect={handleMachineSelect}
          onCancel={() => setPendingAssignment(null)}
        />
      )}
    </DndContext>
  );
}
