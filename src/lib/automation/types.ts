/**
 * Automation engine types. Everything in src/lib/automation/ except the
 * client-only files (store, runtime, adapter, cloud) is plain TypeScript with
 * no React or browser dependencies, so the engine can run anywhere the
 * workspace data is (today: the signed-in user's app; later: a server job).
 */
import type { Sprint, Status, Task } from "../types";

export type NodeCategory = "trigger" | "condition" | "action" | "utility";

/** Output handles. Conditions use true/false; everything else uses "out". */
export type HandleId = "out" | "true" | "false";

export interface WFNode {
  id: string;
  /** Registry key, e.g. "trigger.task_created". */
  type: string;
  position: { x: number; y: number };
  /** Optional custom name shown on the canvas. */
  label?: string;
  config: Record<string, unknown>;
}

export interface WFEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: HandleId | null;
}

export interface WorkflowDefinition {
  nodes: WFNode[];
  edges: WFEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export type WorkflowStatus = "draft" | "active" | "inactive";

export interface WorkflowSettings {
  /** Let this workflow's own changes trigger it again (off by default). */
  allowSelfTrigger: boolean;
  /** Hard cap on runs per rolling hour. */
  maxRunsPerHour: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  definition: WorkflowDefinition;
  settings: WorkflowSettings;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** When the workflow was last switched on; watch triggers ignore older sprints. */
  activatedAt: string | null;
  lastRunAt: string | null;
  templateId?: string | null;
}

/* ---------- Events ---------- */

export type EventType =
  | "task_created"
  | "task_updated"
  | "task_status_changed"
  | "task_assigned"
  | "task_completed"
  | "task_deadline_approaching"
  | "task_overdue"
  | "sprint_created"
  | "sprint_started"
  | "sprint_completed"
  | "schedule"
  | "manual";

export interface AutomationEvent {
  /** Stable id used to avoid processing the same event twice. */
  id: string;
  type: EventType;
  at: string;
  taskId?: string | null;
  sprintId?: string | null;
  from?: Status | null;
  to?: Status | null;
  assignee?: string | null;
  /** Days until the deadline (deadline triggers). */
  daysLeft?: number | null;
  /** Set when an automation caused this event. */
  origin?: { workflowId: string; depth: number } | null;
}

/* ---------- Data flowing between nodes ---------- */

export interface Item {
  task?: Task | null;
  sprint?: Sprint | null;
  event?: AutomationEvent | null;
  report?: SprintReport | null;
  /** Values produced by utility nodes, readable as {{vars.name}}. */
  vars: Record<string, unknown>;
}

export interface SprintReport {
  sprintId: string;
  sprintName: string;
  generatedAt: string;
  total: number;
  completed: number;
  remaining: number;
  blocked: number;
  overdue: number;
  percent: number;
  estimateDays: number;
  actualDays: number;
  byStatus: Record<string, number>;
  summary: string;
}

/* ---------- Execution records ---------- */

export type ExecStatus = "success" | "failed" | "running" | "waiting" | "cancelled";
export type ExecSource = "event" | "schedule" | "manual" | "test";
export type NodeExecStatus = "success" | "failed" | "skipped" | "running" | "waiting";

export interface NodeExecution {
  id: string;
  nodeId: string;
  nodeType: string;
  label: string;
  status: NodeExecStatus;
  input: unknown;
  output: unknown;
  /** Which output a condition took, with item counts. */
  branch?: { true: number; false: number } | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  attempts: number;
  error: string | null;
}

export interface QueueEntry {
  nodeId: string;
  items: Item[];
}

export interface ResumeState {
  resumeAt: string;
  queue: QueueEntry[];
  steps: number;
  activeMs: number;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  triggerEventId: string | null;
  source: ExecSource;
  status: ExecStatus;
  dryRun: boolean;
  /** How many automations deep this run is (event chains). */
  depth: number;
  input: unknown;
  output: unknown;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  nodes: NodeExecution[];
  resume: ResumeState | null;
}

/* ---------- Notifications, schedules, audit ---------- */

export interface AppNotification {
  id: string;
  workflowId: string | null;
  executionId: string | null;
  recipientId: string;
  type: "in_app" | "email";
  title: string;
  message: string;
  taskId: string | null;
  createdAt: string;
  readAt: string | null;
}

export type ScheduleType = "daily" | "weekly" | "monthly" | "interval";

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  scheduleType: ScheduleType;
  config: ScheduleConfig;
  nextExecutionAt: string | null;
  isActive: boolean;
}

export interface ScheduleConfig {
  frequency: ScheduleType;
  /** "HH:MM", local time */
  time: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  dayOfMonth: number;
  intervalMinutes: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  workflowId: string | null;
  action: string;
  detail: string;
}

/* ---------- What the engine may do to the workspace ---------- */

export interface NewTaskInput {
  title: string;
  description?: string;
  sprintId: string;
  priority?: Task["priority"];
  status?: Status;
  targetDate?: string | null;
  assignee?: string;
  estimateDays?: number;
}

export interface WorkspaceAdapter {
  /** Dry runs work on a private copy and change nothing. */
  readonly dryRun: boolean;
  now(): Date;
  tasks(): Task[];
  sprints(): Sprint[];
  activeSprintId(): string;
  getTask(id: string): Task | null;
  getSprint(id: string): Sprint | null;
  ownerName(): string;
  ownerId(): string;

  createTask(input: NewTaskInput): Task;
  updateTask(id: string, patch: Partial<Task>): Task;
  setStatus(id: string, status: Status, reason?: string): Task;
  addComment(id: string, text: string, author: string): Task;
  createSprint(input: Omit<Sprint, "id" | "createdAt">, makeActive: boolean): Sprint;
  updateSprint(id: string, patch: Partial<Sprint>): Sprint;
  notify(n: { title: string; message: string; taskId: string | null }): AppNotification;
  sendEmail(n: { subject: string; body: string }): Promise<{ id: string; to: string }>;
  /** Text from the user's own Gemini/OpenAI key (via Cali's server). */
  generateText(p: AiRequest): Promise<string>;
}

export interface AiRequest {
  provider: "gemini" | "openai";
  model: string;
  system: string;
  prompt: string;
  maxWords: number;
}

/** Thrown by nodes. Recoverable errors are retried (network hiccups, etc.). */
export class NodeError extends Error {
  constructor(
    message: string,
    readonly recoverable = false,
  ) {
    super(message);
    this.name = "NodeError";
  }
}
