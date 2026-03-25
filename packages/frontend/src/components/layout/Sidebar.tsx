import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { Users, Cpu, Calendar, Factory } from "lucide-react";

const navItems = [
  { to: "/", icon: Users, label: "Workforce" },
  { to: "/machines", icon: Cpu, label: "Machines" },
  { to: "/scheduler", icon: Calendar, label: "Scheduler" },
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

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
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
      </nav>

      <div className="p-4 border-t border-factory-border">
        <p className="text-xs text-slate-500 text-center">FactoryMind v0.1.0</p>
      </div>
    </aside>
  );
}
