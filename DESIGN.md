# FactoryMind Design System

## Color Palette

### Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `factory-dark` | `#0f172a` | Page background |
| `factory-sidebar` | `#1e293b` | Sidebar background |
| `factory-card` | `#1e293b` | Card / panel background |
| `factory-border` | `#334155` | Borders, dividers |

### Primary (Blue)
| Token | Hex | Usage |
|-------|-----|-------|
| `primary-300` | `#93c5fd` | Hover text |
| `primary-400` | `#60a5fa` | Active nav, accent text, links |
| `primary-500` | `#3b82f6` | Focus rings, active borders |
| `primary-600` | `#2563eb` | Buttons, emphasis |
| `primary-600/20` | — | Active nav background, card highlights |

### Severity
| Level | Color | Token | Usage |
|-------|-------|-------|-------|
| Critical | Red | `red-500` (#ef4444) | Alerts, high-risk indicators, errors |
| Warning | Amber | `amber-500` (#f59e0b) | Warnings, medium-risk indicators |
| Healthy / Info | Emerald | `emerald-500` (#22c55e) | Success states, low-risk, healthy banners |
| Accent / Neutral | Blue | `blue-500` (#3b82f6) | Info-level alerts, neutral indicators |

### Severity Backgrounds (translucent)
- Critical: `bg-red-500/10 border border-red-500/30`
- Warning: `bg-amber-500/10 border border-amber-500/30`
- Healthy: `bg-emerald-500/10 border border-emerald-500/30`
- Info: `bg-blue-500/15 border border-blue-500/20`

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `white` | `#ffffff` | Page titles, primary headings |
| `slate-200` | `#e2e8f0` | Body text, card titles |
| `slate-400` | `#94a3b8` | Secondary text, labels, descriptions |
| `slate-500` | `#64748b` | Muted text, timestamps, section headers |
| `slate-600` | `#475569` | Placeholder text |

## Typography

System font stack (Tailwind defaults). No custom fonts.

| Element | Classes | Example |
|---------|---------|---------|
| Page title | `text-2xl font-bold text-white` | "Command Center" |
| Page subtitle | `text-sm text-slate-400` | "Next 24 hours — predictions updated 3 min ago" |
| Section title | `text-sm font-semibold text-slate-200` | "Machine Risk — Next 24 Hours" |
| Section header (nav) | `text-[10px] font-semibold text-slate-500 uppercase tracking-wider` | "PREDICTIONS" |
| Body text | `text-sm text-slate-200` | Card content |
| Label | `text-xs text-slate-400` | KPI labels |
| Micro text | `text-[10px] text-slate-500` | Timestamps, badges |
| Badge | `text-[9px] font-bold px-1.5 py-0.5 rounded` | Priority badges |

## Spacing

Tailwind default scale. Key patterns:

| Context | Value | Usage |
|---------|-------|-------|
| Page padding | `px-6 py-6` or `p-6` | Main content area |
| Section gap | `gap-4` or `gap-5` | Between major sections |
| Card padding | `p-5` | Inside card panels |
| KPI grid gap | `gap-3` | Between metric cards |
| Item spacing | `space-y-1.5` | Between list items |
| Sidebar padding | `p-4` | Nav section padding |

## Component Patterns

### Card Container
```
bg-factory-card border border-factory-border rounded-xl p-5
```

### MetricCard
Reusable KPI card with icon, label, value, sublabel. Used in Schedule Planner and Command Center.
- Grid: `grid-cols-2 md:grid-cols-4 gap-3`

### LoadingState
Centered spinner with message text. Used across all pages.

### ErrorState (new)
Plain-language error message with retry button. Matches severity color system.
- Layout: centered icon + message + retry button
- Colors: `bg-red-500/10` tint with `text-red-400` message

### Alert Banner
Full-width banner at top of Command Center.
- Critical: red severity background with alert icon
- Healthy: emerald severity background with checkmark
- Rounded: `rounded-xl`
- Padding: `p-4`

### Sidebar Navigation
Grouped sections with uppercase headers.
- Group header: `text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1`
- Nav item: `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium`
- Active: `bg-primary-600/20 text-primary-400`
- Inactive: `text-slate-400 hover:text-slate-200 hover:bg-slate-800`

## Chart Theming

All charts use Recharts with dark theme:
- Background: transparent (inherits card background)
- Grid lines: `#334155` (factory-border)
- Axis text: `#94a3b8` (slate-400), `text-xs`
- Tooltip: `bg-slate-800 border border-factory-border rounded-lg`
- Data colors: severity system (red/amber/emerald/blue)
- Reference lines: dashed, severity-colored

## Interaction Patterns

### Hover States
- Cards: subtle border brightening (`hover:border-slate-500`)
- Nav items: `hover:text-slate-200 hover:bg-slate-800`
- Buttons: color shift toward lighter shade
- Action cards: `hover:bg-slate-700/50` with ChevronRight visible

### Transitions
- All interactive elements: `transition-colors` or `transition-all`
- Duration: Tailwind default (150ms)
- Entrance animations: fade-in for banners, stagger for card grids (50ms delay)

### Focus States
- Focus ring: `focus:ring-2 focus:ring-primary-500`
- Outline: `focus:outline-none` (ring replaces outline)
