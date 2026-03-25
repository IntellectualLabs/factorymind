import type { CorrelationPair } from "@factorymind/types";

interface CorrelationHeatmapProps {
  data: { pairs: CorrelationPair[] };
  title?: string;
}

function getCorrelationColor(value: number): string {
  const clamped = Math.max(-1, Math.min(1, value));
  if (clamped > 0) {
    const intensity = Math.round(clamped * 200);
    return `rgb(${30 + intensity}, ${80 + Math.round(clamped * 60)}, ${255 - intensity})`;
  }
  if (clamped < 0) {
    const intensity = Math.round(Math.abs(clamped) * 200);
    return `rgb(${200 + Math.round(Math.abs(clamped) * 55)}, ${80 - Math.round(Math.abs(clamped) * 40)}, ${80 - Math.round(Math.abs(clamped) * 40)})`;
  }
  return "#334155";
}

export default function CorrelationHeatmap({ data, title }: CorrelationHeatmapProps) {
  if (!data.pairs.length) return null;

  return (
    <div className="bg-factory-card border border-factory-border rounded-xl p-5">
      {title && <h3 className="text-sm font-medium text-slate-300 mb-4">{title}</h3>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.pairs.length, 5)}, 1fr)` }}>
        {data.pairs.map((pair) => (
          <div
            key={`${pair.x}-${pair.y}`}
            className="rounded-lg p-3 text-center cursor-default hover:ring-1 hover:ring-white/20 transition-all"
            style={{ backgroundColor: getCorrelationColor(pair.value) }}
            title={`${pair.x} vs ${pair.y}: r = ${pair.value}`}
          >
            <p className="text-[10px] text-slate-300/80 font-medium truncate">{pair.x}</p>
            <p className="text-[10px] text-slate-400/60 mb-1">vs {pair.y}</p>
            <p className="text-lg font-mono font-bold text-white">
              {pair.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-xs text-slate-500">-1 (inverse)</span>
        <div className="flex h-3 w-32 rounded overflow-hidden">
          {Array.from({ length: 20 }, (_, i) => {
            const v = (i / 19) * 2 - 1;
            return (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: getCorrelationColor(v) }}
              />
            );
          })}
        </div>
        <span className="text-xs text-slate-500">+1 (direct)</span>
      </div>
    </div>
  );
}
