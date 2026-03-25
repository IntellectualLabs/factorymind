import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

interface HeatmapGridProps {
  data: Array<{
    team: string;
    shift: string;
    values: Array<{ date: string; value: number }>;
  }>;
  title?: string;
  colorScale?: "green" | "blue" | "red";
}

function getColor(value: number, scale: string): string {
  const clamped = Math.max(0, Math.min(1, value));
  if (scale === "red") {
    const intensity = Math.round(clamped * 255);
    return `rgb(${intensity}, ${Math.round(50 + (1 - clamped) * 100)}, ${Math.round(50 + (1 - clamped) * 100)})`;
  }
  if (scale === "blue") {
    const intensity = Math.round(clamped * 255);
    return `rgb(${Math.round(30 + (1 - clamped) * 60)}, ${Math.round(80 + clamped * 80)}, ${intensity})`;
  }
  // green
  const intensity = Math.round(clamped * 200);
  return `rgb(${Math.round(30 + (1 - clamped) * 80)}, ${100 + intensity}, ${Math.round(50 + (1 - clamped) * 50)})`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateLabel(dateStr: string): string {
  // Handle "M/D/YYYY" or "YYYY-MM-DD" formats
  let month: number, day: number;
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    month = parseInt(parts[0], 10) - 1;
    day = parseInt(parts[1], 10);
  } else {
    const parts = dateStr.split("-");
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  }
  return `${MONTHS[month]} ${day}`;
}

// Aggregate daily values into weekly averages
function aggregateWeekly(values: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> {
  const weeks: Array<{ date: string; total: number; count: number }> = [];
  for (let i = 0; i < values.length; i += 7) {
    const chunk = values.slice(i, i + 7);
    const total = chunk.reduce((sum, v) => sum + v.value, 0);
    weeks.push({
      date: chunk[0].date,
      total,
      count: chunk.length,
    });
  }
  return weeks.map((w) => ({ date: w.date, value: w.total / w.count }));
}

export default function HeatmapGrid({
  data,
  title,
  colorScale = "green",
}: HeatmapGridProps) {
  if (!data.length) return null;

  // Aggregate to weekly and take last 16 weeks for readability
  const processedData = useMemo(() => {
    return data.slice(0, 24).map((row) => ({
      ...row,
      values: aggregateWeekly(row.values).slice(-16),
    }));
  }, [data]);

  const dates = processedData[0]?.values.map((v) => v.date) || [];
  const colCount = dates.length;

  return (
    <div className="bg-factory-card border border-factory-border rounded-xl p-5 overflow-auto">
      {title && <h3 className="text-sm font-medium text-slate-300 mb-4">{title}</h3>}
      <div className="min-w-[600px]">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `150px repeat(${colCount}, minmax(40px, 1fr))` }}
        >
          {/* Header */}
          <div className="text-xs text-slate-500 p-1 font-medium">Team / Shift</div>
          {dates.map((d) => (
            <div key={d} className="text-[10px] text-slate-400 p-1 text-center font-medium">
              {formatDateLabel(d)}
            </div>
          ))}

          {/* Rows */}
          {processedData.map((row) => (
            <Fragment key={`${row.team}-${row.shift}`}>
              <div className="text-xs text-slate-300 p-1.5 truncate flex items-center">
                {row.team} / {row.shift.replace("Shift ", "S")}
              </div>
              {row.values.map((v, i) => (
                <div
                  key={i}
                  className="h-7 rounded-sm cursor-pointer hover:ring-1 hover:ring-white/30 transition-all"
                  style={{ backgroundColor: getColor(v.value, colorScale) }}
                  title={`${row.team} ${row.shift}\n${formatDateLabel(v.date)}: ${(v.value * 100).toFixed(0)}% attendance`}
                />
              ))}
            </Fragment>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 justify-end">
          <span className="text-xs text-slate-500">0%</span>
          <div className="flex h-3 w-32 rounded overflow-hidden">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: getColor(i / 19, colorScale) }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">100%</span>
          <span className="text-[10px] text-slate-500 ml-2">(weekly avg)</span>
        </div>
      </div>
    </div>
  );
}
