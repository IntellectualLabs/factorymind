import type { MachinePrediction } from "@factorymind/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface MachineSelectModalProps {
  machines: MachinePrediction[];
  orderType: string;
  onSelect: (machineId: string) => void;
  onCancel: () => void;
}

export default function MachineSelectModal({
  machines,
  orderType,
  onSelect,
  onCancel,
}: MachineSelectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-factory-card border border-factory-border rounded-xl w-[480px] max-h-[500px] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-factory-border">
          <div>
            <h3 className="text-sm font-medium text-white">Select Machine</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Order type: {orderType}
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-auto max-h-[380px] p-2">
          <button
            onClick={() => onSelect("auto")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800/50 text-left mb-1 border border-dashed border-slate-600"
          >
            <span className="text-sm font-medium text-slate-300">Auto-assign</span>
            <span className="text-xs text-slate-500 ml-auto">Let system choose</span>
          </button>
          {machines.map((m) => (
            <button
              key={m.machineId}
              onClick={() => onSelect(m.machineId)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-800/50 text-left mb-0.5"
            >
              <span className="text-sm font-medium text-slate-200">Machine {m.machineId}</span>
              <div className="flex-1 mx-3">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      m.riskLevel === "high" ? "bg-red-500" :
                      m.riskLevel === "medium" ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${m.maintenanceScore * 100}%` }}
                  />
                </div>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                  m.riskLevel === "high" && "bg-red-500/20 text-red-400",
                  m.riskLevel === "medium" && "bg-amber-500/20 text-amber-400",
                  m.riskLevel === "low" && "bg-emerald-500/20 text-emerald-400"
                )}
              >
                {m.riskLevel}
              </span>
              <span className="text-xs text-slate-400 shrink-0 font-mono w-12 text-right">
                {(m.maintenanceScore * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
