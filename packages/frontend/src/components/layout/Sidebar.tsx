import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { Shield, Calendar, Users, Cpu, Factory } from "lucide-react";

const navGroups = [
  {
    label: "Predictions",
    items: [
      { to: "/", icon: Shield, label: "Command Center" },
      { to: "/scheduler", icon: Calendar, label: "Schedule Planner" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/analytics/workforce", icon: Users, label: "Workforce" },
      { to: "/analytics/machines", icon: Cpu, label: "Machines" },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-factory-sidebar border-r border-factory-border flex flex-col">
      <div className="p-6 border-b border-factory-border">
        <div className="flex items-center gap-3">
          <Factory className="w-8 h-8 text-primary-400" />
          <div>
            <h1 className="text-lg font-bold text-white">FactoryMind</h1>
            <p className="text-xs text-slate-400">Smart Factory Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-600/20 text-primary-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    )
                  }
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-factory-border">
        <p className="text-xs text-slate-500 text-center">FactoryMind v0.1.0</p>
      </div>
    </aside>
  );
}
