import { useState, useCallback } from "react";
import {
  useSchedulePredictions,
  useScheduleOrders,
  useAssignOrder,
} from "@/api/client";
import LoadingState from "@/components/shared/LoadingState";
import { cn, formatPercent } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { WorkOrder, ScheduleWarning } from "@factorymind/types";
import { AlertTriangle, GripVertical, X } from "lucide-react";

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// ── Draggable Work Order Card ──

function WorkOrderCard({ order, isDragging }: { order: WorkOrder; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: order.id,
    data: order,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-slate-700 border border-factory-border rounded-lg p-3 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        order.priority === "high" && "border-l-4 border-l-red-500",
        order.priority === "medium" && "border-l-4 border-l-amber-500",
        order.priority === "low" && "border-l-4 border-l-emerald-500"
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-200 truncate">{order.id}</p>
          <p className="text-xs text-slate-400 truncate">{order.description}</p>
          <p className="text-xs text-slate-500 mt-1">Crew: {order.crewNeeded}</p>
        </div>
      </div>
    </div>
  );
}

// ── Droppable Day Cell ──

function DayCell({
  day,
  weekday,
  team,
  shift,
  attendance,
  assignedOrders,
}: {
  day: string;
  weekday: string;
  team: string;
  shift: string;
  attendance: number;
  assignedOrders: WorkOrder[];
}) {
  const dropId = `${day}-${team}-${shift}`;
  const { isOver, setNodeRef } = useDroppable({ id: dropId, data: { day, team, shift } });

  const isEmpty = assignedOrders.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] rounded-lg border p-2.5 transition-all",
        isOver
          ? "bg-primary-600/20 border-primary-500 border-solid shadow-lg shadow-primary-500/10"
          : isEmpty
            ? "bg-slate-800/30 border-dashed border-slate-600 hover:border-slate-500"
            : "bg-slate-800/50 border-factory-border border-solid"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">{weekday.slice(0, 3)}</span>
        <span
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded",
            attendance >= 0.85
              ? "bg-emerald-500/20 text-emerald-400"
              : attendance >= 0.7
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
          )}
        >
          {formatPercent(attendance)}
        </span>
      </div>
      {assignedOrders.map((o) => (
        <div
          key={o.id}
          className="text-xs bg-primary-600/20 text-primary-300 rounded-md px-2 py-1.5 mb-1 border border-primary-500/20"
        >
          <span className="font-medium">{o.id}</span>
          <span className="text-primary-400/60 ml-1 text-[10px]">{o.description.split(" - ")[0]}</span>
        </div>
      ))}
      {isEmpty && !isOver && (
        <div className="flex items-center justify-center h-[60px] text-slate-600">
          <div className="text-center">
            <span className="text-lg leading-none">+</span>
            <p className="text-[10px] mt-0.5">Drop here</p>
          </div>
        </div>
      )}
      {isOver && isEmpty && (
        <div className="flex items-center justify-center h-[60px] text-primary-400">
          <span className="text-xs font-medium">Release to assign</span>
        </div>
      )}
    </div>
  );
}

// ── Main Scheduler ──

export default function SchedulePlanner() {
  const [weekStart] = useState(getWeekStart);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ScheduleWarning[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("Team 1");
  const [selectedShift, setSelectedShift] = useState("Shift 1");

  const { data: predictions, isLoading: predsLoading } = useSchedulePredictions(weekStart);
  const { data: ordersData, isLoading: ordersLoading } = useScheduleOrders(weekStart);
  const assignMutation = useAssignOrder();

  const orders = ordersData?.orders || [];
  const unassigned = orders.filter((o) => !o.assignedDay);
  const assigned = orders.filter((o) => o.assignedDay);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const dropData = over.data.current as { day: string; team: string; shift: string } | undefined;
      if (!dropData) return;

      const result = await assignMutation.mutateAsync({
        orderId: String(active.id),
        team: dropData.team,
        shift: dropData.shift,
        machineId: "auto",
        day: dropData.day,
        weekStart,
      });

      if (result.warnings.length > 0) {
        setWarnings((prev) => [...prev, ...result.warnings]);
        setTimeout(() => setWarnings([]), 5000);
      }
    },
    [assignMutation, weekStart]
  );

  if (predsLoading || ordersLoading) {
    return <LoadingState message="Loading schedule predictions..." />;
  }

  const days = predictions?.days || [];
  const teams = ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6"];

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Schedule Planner</h2>
          <p className="text-sm text-slate-400 mt-1">
            Week of {weekStart} — drag work orders to assign
          </p>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm",
                  w.severity === "error"
                    ? "bg-red-500/20 text-red-300"
                    : "bg-amber-500/20 text-amber-300"
                )}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {w.message}
                <button
                  onClick={() => setWarnings((p) => p.filter((_, idx) => idx !== i))}
                  className="ml-auto"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Team/Shift selectors */}
        <div className="flex gap-3">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-slate-800 border border-factory-border rounded-lg px-3 py-1.5 text-sm text-slate-200"
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
            className="bg-slate-800 border border-factory-border rounded-lg px-3 py-1.5 text-sm text-slate-200"
          >
            <option value="Shift 1">Shift 1</option>
            <option value="Shift 2">Shift 2</option>
            <option value="Shift 3">Shift 3</option>
          </select>
        </div>

        <div className="flex gap-6">
          {/* Unassigned Work Orders Sidebar */}
          <div className="w-72 flex-shrink-0 space-y-2">
            <h3 className="text-sm font-medium text-slate-300">
              Unassigned ({unassigned.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
              {unassigned.map((order) => (
                <WorkOrderCard
                  key={order.id}
                  order={order}
                  isDragging={activeId === order.id}
                />
              ))}
            </div>
          </div>

          {/* Week Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {days.map((day) => (
                <div key={day.date} className="text-center">
                  <span className="text-xs font-medium text-slate-400">
                    {day.weekday.slice(0, 3)}
                  </span>
                  <p className="text-[10px] text-slate-500">{day.date.slice(5)}</p>
                </div>
              ))}

              {/* Grid cells for selected team */}
              {days.map((day) => {
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
                    key={`${day.date}-${selectedTeam}`}
                    day={day.date}
                    weekday={day.weekday}
                    team={selectedTeam}
                    shift={selectedShift}
                    attendance={teamPred?.predictedAttendance || 0.85}
                    assignedOrders={dayOrders}
                  />
                );
              })}
            </div>

            {/* Machine Risk Summary */}
            {days[0]?.machines && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Machine Risk</h3>
                <div className="flex flex-wrap gap-2">
                  {days[0].machines.slice(0, 10).map((m) => (
                    <div
                      key={m.machineId}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border",
                        m.riskLevel === "high" &&
                          "bg-red-500/10 border-red-500/30 text-red-400",
                        m.riskLevel === "medium" &&
                          "bg-amber-500/10 border-amber-500/30 text-amber-400",
                        m.riskLevel === "low" &&
                          "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      )}
                    >
                      {m.machineId} — {m.riskLevel}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId ? (
          <div className="bg-slate-700 border border-primary-500 rounded-lg p-3 shadow-xl">
            <p className="text-sm font-medium text-white">{activeId}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
