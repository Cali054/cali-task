import {
  Ban,
  CheckCircle2,
  Circle,
  FlaskConical,
  Loader,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { Priority, Status } from "./types";

export const STATUS_META: Record<Status, { label: string; color: string; icon: LucideIcon }> = {
  todo: { label: "To Do", color: "var(--st-todo)", icon: Circle },
  in_progress: { label: "In Progress", color: "var(--st-progress)", icon: Loader },
  for_retest: { label: "For Retest", color: "var(--st-retest)", icon: RotateCcw },
  for_testing: { label: "For Testing", color: "var(--st-testing)", icon: FlaskConical },
  blocked: { label: "Blocked", color: "var(--st-blocked)", icon: Ban },
  completed: { label: "Completed", color: "var(--st-done)", icon: CheckCircle2 },
};

export const PRIORITY_META: Record<Priority, { label: string; color: string; rank: number }> = {
  low: { label: "Low", color: "var(--st-todo)", rank: 0 },
  medium: { label: "Medium", color: "var(--st-progress)", rank: 1 },
  high: { label: "High", color: "var(--warn)", rank: 2 },
  critical: { label: "Critical", color: "var(--st-blocked)", rank: 3 },
};
