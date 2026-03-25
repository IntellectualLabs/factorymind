import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  filters: Array<{
    key: string;
    label: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
  }>;
  className?: string;
}

export default function FilterBar({ filters, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">{filter.label}</label>
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="bg-slate-800 border border-factory-border rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
