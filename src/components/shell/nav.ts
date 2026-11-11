import {
  BarChart3,
  Ban,
  GanttChartSquare,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  Settings,
  type LucideIcon,
} from "lucide-react";

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "My Tasks", icon: ListTodo },
  { href: "/board", label: "Sprint Board", icon: KanbanSquare },
  { href: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { href: "/blocked", label: "Blocked Tasks", icon: Ban },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];
