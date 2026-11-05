import type { AppData, Priority, Status, Task } from "./types";
import { addWorkingDays, nextWorkingDay, today, uid } from "./utils";

interface SeedRow {
  code: string;
  title: string;
  estimate: number;
  status: Status;
  priority: Priority;
  notes?: string;
}

const SPRINT_2_TASKS: SeedRow[] = [
  { code: "41959", title: "Retest IN[12643]", estimate: 0.5, status: "for_retest", priority: "high" },
  { code: "41971", title: "Retest IN[13084]", estimate: 0.5, status: "for_retest", priority: "high" },
  { code: "41947", title: "IN[12962]", estimate: 1, status: "todo", priority: "medium" },
  { code: "41965", title: "[11764]", estimate: 1, status: "todo", priority: "medium" },
  { code: "42021", title: "[12634]", estimate: 1, status: "todo", priority: "medium" },
  { code: "42025", title: "Both Accounting and Budget [13246]", estimate: 1, status: "todo", priority: "high" },
  {
    code: "42027",
    title: "Incident [13242]",
    estimate: 1,
    status: "blocked",
    priority: "high",
    notes: "Waiting for clarification and finalization of the requirements. For now, edit the amount.",
  },
];

/**
 * Builds the initial workspace. Sprint 2 starts on the first launch day (or the
 * next working day) so the sample plan is always current.
 */
export function buildSeed(): AppData {
  const now = new Date().toISOString();
  const start = nextWorkingDay(today());
  const end = addWorkingDays(start, 10);
  const sprintId = uid();

  // Schedule tasks back-to-back by their estimates (two half-days share a day).
  let offset = 0;
  const tasks: Task[] = SPRINT_2_TASKS.map((row) => {
    const startDate = addWorkingDays(start, Math.floor(offset) + 1);
    const targetDate = addWorkingDays(start, Math.ceil(offset + row.estimate));
    offset += row.estimate;
    return {
      id: uid(),
      code: row.code,
      title: row.title,
      description: "",
      sprintId,
      estimateDays: row.estimate,
      timeLogs: [],
      status: row.status,
      priority: row.priority,
      startDate,
      targetDate,
      completedDate: null,
      notes: row.notes ?? "",
      dependencies: [],
      blocker:
        row.status === "blocked"
          ? {
              reason: row.notes ?? "",
              blockedOn: start,
              waitingOn: "Requirements owner",
              requiredAction: "Edit the amount for now; finalize once requirements are confirmed.",
              updates: [],
            }
          : null,
      history: [{ at: now, from: null, to: row.status }],
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    version: 1,
    activeSprintId: sprintId,
    sprints: [
      {
        id: sprintId,
        name: "Sprint 2",
        goal: "Close out retests and incident fixes for Accounting & Budget.",
        startDate: start,
        endDate: end,
        targetLabel: "2–3 days + testing",
        targetDaysMin: 2,
        targetDaysMax: 3,
        createdAt: now,
      },
    ],
    tasks,
    activity: [
      {
        id: uid(),
        at: now,
        taskId: null,
        kind: "sprint",
        message: `Sprint 2 created with ${tasks.length} imported tasks`,
      },
    ],
    settings: { userName: "Cali", showIntro: true },
  };
}

/** A fresh workspace for a new account: one empty sprint starting today. */
export function buildEmptyWorkspace(userName = "Cali"): AppData {
  const now = new Date().toISOString();
  const start = nextWorkingDay(today());
  const sprintId = uid();
  return {
    version: 1,
    activeSprintId: sprintId,
    sprints: [
      {
        id: sprintId,
        name: "Sprint 1",
        goal: "",
        startDate: start,
        endDate: addWorkingDays(start, 10),
        targetLabel: "",
        targetDaysMin: null,
        targetDaysMax: null,
        createdAt: now,
      },
    ],
    tasks: [],
    activity: [{ id: uid(), at: now, taskId: null, kind: "sprint", message: "Workspace created" }],
    // New accounts get the guided tours.
    settings: { userName, showIntro: true, tours: { auto: true, seen: [] } },
  };
}
