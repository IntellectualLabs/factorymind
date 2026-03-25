import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface GaugeChartProps {
  value: number; // 0-1
  label: string;
  title?: string;
  thresholds?: { low: number; medium: number }; // default: 0.4, 0.7
}

export default function GaugeChart({
  value,
  label,
  title,
  thresholds = { low: 0.4, medium: 0.7 },
}: GaugeChartProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const color =
    clamped >= thresholds.medium
      ? "#ef4444"
      : clamped >= thresholds.low
        ? "#f59e0b"
        : "#22c55e";

  const data = [
    { name: "value", value: clamped },
    { name: "empty", value: 1 - clamped },
  ];

  return (
    <div className="bg-factory-card border border-factory-border rounded-xl p-4 flex flex-col items-center">
      {title && <h3 className="text-xs font-medium text-slate-400 mb-1">{title}</h3>}
      <div className="w-28 h-16 relative">
        <ResponsiveContainer width="100%" height={64}>
          <PieChart>
            <Pie
              data={data}
              startAngle={180}
              endAngle={0}
              innerRadius={30}
              outerRadius={45}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="#334155" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="text-lg font-bold" style={{ color }}>
            {(clamped * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-slate-400 mt-1">{label}</span>
    </div>
  );
}
