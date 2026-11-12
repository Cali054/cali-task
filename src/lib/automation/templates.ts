import { NODE_BY_TYPE } from "./nodes";
import type { HandleId, WFEdge, WFNode, WorkflowDefinition } from "./types";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  steps: string[];
  build: (makeId: () => string) => WorkflowDefinition;
}

type Step = { type: string; config?: Record<string, unknown>; label?: string; handle?: HandleId };

/** Lays steps out left-to-right; `handle` is the output used to reach the next step. */
function chain(makeId: () => string, steps: Step[]): WorkflowDefinition {
  const nodes: WFNode[] = steps.map((s, i) => ({
    id: makeId(),
    type: s.type,
    label: s.label,
    position: { x: i * 300, y: 0 },
    config: { ...(NODE_BY_TYPE.get(s.type)?.defaults ?? {}), ...(s.config ?? {}) },
  }));
  const edges: WFEdge[] = nodes.slice(1).map((n, i) => ({
    id: makeId(),
    source: nodes[i].id,
    target: n.id,
    sourceHandle: steps[i].handle ?? "out",
  }));
  return { nodes, edges };
}

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: "deadline-reminder",
    name: "Task Deadline Reminder",
    description: "A day before a task is due, remind the assignee unless it's already done.",
    icon: "alarm-clock",
    steps: ["Deadline approaching", "Status is not Completed", "Notify the assignee"],
    build: (id) =>
      chain(id, [
        { type: "trigger.task_deadline_approaching", config: { interval: "1" } },
        { type: "condition.status_equals", config: { operator: "not_equals", status: "completed" }, handle: "true" },
        {
          type: "action.notify",
          config: { title: "#{{task.code}} is due soon", message: "{{task.title}} — assigned to {{task.assignee}}, due {{task.targetDate}}." },
        },
      ]),
  },
  {
    id: "overdue-detection",
    name: "Automatic Overdue Detection",
    description: "Every morning, flag unfinished tasks that are past due and notify the assignee.",
    icon: "alert-triangle",
    steps: ["Daily at 9:00", "Due before today AND not Completed", "Label as overdue", "Notify the assignee"],
    build: (id) =>
      chain(id, [
        { type: "trigger.schedule", config: { frequency: "daily", time: "09:00", forEach: "open_tasks" } },
        {
          type: "condition.and_or",
          config: {
            conditions: {
              match: "all",
              groups: [
                {
                  match: "all",
                  conditions: [
                    { field: "task.targetDate", operator: "lt", value: "today" },
                    { field: "task.status", operator: "not_equals", value: "completed" },
                  ],
                },
              ],
            },
          },
          handle: "true",
        },
        { type: "action.update_task", config: { addLabel: "overdue" } },
        { type: "action.notify", config: { title: "#{{task.code}} is overdue", message: "{{task.title}} was due {{task.targetDate}} ({{task.assignee}})." } },
      ]),
  },
  {
    id: "completion-notification",
    name: "Task Completion Notification",
    description: "When a task is completed, let the sprint owner know.",
    icon: "check-circle",
    steps: ["Task completed", "Notify the sprint owner"],
    build: (id) =>
      chain(id, [
        { type: "trigger.task_completed" },
        { type: "action.notify", config: { title: "#{{task.code}} completed", message: "{{task.title}} is done in {{sprint.name}} ({{sprint.progress}}% complete)." } },
      ]),
  },
  {
    id: "sprint-summary",
    name: "Automatic Sprint Summary",
    description: "When a sprint finishes, count completed and remaining work, build a report and notify the owner.",
    icon: "trophy",
    steps: ["Sprint completed", "Count completed tasks", "Count remaining tasks", "Generate sprint report", "Notify the sprint owner"],
    build: (id) =>
      chain(id, [
        { type: "trigger.sprint_completed" },
        { type: "utility.calculate", config: { mode: "metric", metric: "completed", sprint: "item", outputKey: "completed" }, label: "Completed tasks" },
        { type: "utility.calculate", config: { mode: "metric", metric: "remaining", sprint: "item", outputKey: "remaining" }, label: "Remaining tasks" },
        { type: "action.sprint_report", config: { sprint: "item" } },
        {
          type: "action.notify",
          config: { title: "{{sprint.name}} summary", message: "{{vars.completed}} completed, {{vars.remaining}} remaining. {{vars.reportSummary}}" },
        },
      ]),
  },
  {
    id: "high-priority",
    name: "High Priority Task Assignment",
    description: "When a High priority task is created, notify the project manager.",
    icon: "signal-high",
    steps: ["Task created", "Priority equals High", "Notify the project manager"],
    build: (id) =>
      chain(id, [
        { type: "trigger.task_created" },
        { type: "condition.priority_equals", config: { operator: "equals", priority: "high" }, handle: "true" },
        { type: "action.notify", config: { title: "High priority: #{{task.code}}", message: "{{task.title}} was created in {{sprint.name}}, due {{task.targetDate}}." } },
      ]),
  },
];
