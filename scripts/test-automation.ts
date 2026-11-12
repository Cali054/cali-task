/**
 * Engine tests. Run with:  npx jiti scripts/test-automation.ts
 * Uses the in-memory adapter, so nothing touches real data.
 */
import { executeWorkflow } from "../src/lib/automation/engine";
import { createMemoryAdapter } from "../src/lib/automation/memory-adapter";
import { itemsForScope, NODE_BY_TYPE, NODE_DEFS } from "../src/lib/automation/nodes";
import { TEMPLATES } from "../src/lib/automation/templates";
import { validateNodeConfig, validateWorkflow } from "../src/lib/automation/validate";
import { nextRun } from "../src/lib/automation/schedule";
import { renderTemplate } from "../src/lib/automation/fields";
import type { Execution, Item, Workflow, WorkflowDefinition } from "../src/lib/automation/types";
import { NodeError } from "../src/lib/automation/types";
import type { AppData, Task } from "../src/lib/types";

let failures = 0;
let passed = 0;
function ok(cond: unknown, msg: string) {
  if (cond) passed++;
  else {
    failures++;
    console.error("  ✗ " + msg);
  }
}

const NOW = new Date(2026, 10, 12, 10, 0, 0); // Nov 12 2026, 10:00 local
let n = 0;
const makeId = () => `id-${++n}`;

function task(p: Partial<Task>): Task {
  return {
    id: makeId(),
    code: String(100 + n),
    title: "Task",
    description: "",
    sprintId: "s1",
    estimateDays: 1,
    timeLogs: [],
    status: "todo",
    priority: "medium",
    startDate: null,
    targetDate: null,
    completedDate: null,
    notes: "",
    dependencies: [],
    blocker: null,
    history: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...p,
  };
}

function data(): AppData {
  return {
    version: 1,
    activeSprintId: "s1",
    activity: [],
    settings: { userName: "Joshua", showIntro: false },
    sprints: [
      { id: "s1", name: "Sprint 2", goal: "", startDate: "2026-11-02", endDate: "2026-11-13", targetLabel: "", targetDaysMin: null, targetDaysMax: null, createdAt: NOW.toISOString() },
    ],
    tasks: [
      task({ id: "t1", code: "41959", title: "Retest login", status: "in_progress", priority: "high", targetDate: "2026-11-10" }),
      task({ id: "t2", code: "41960", title: "Budget export", status: "todo", priority: "medium", targetDate: "2026-11-13" }),
      task({ id: "t3", code: "41961", title: "Docs", status: "completed", priority: "low", targetDate: "2026-11-09", completedDate: "2026-11-09" }),
      task({ id: "t4", code: "41962", title: "Incident", status: "blocked", priority: "critical", targetDate: "2026-11-11" }),
    ],
  };
}

function wf(def: WorkflowDefinition): Workflow {
  return {
    id: "wf1",
    name: "Test",
    description: "",
    status: "active",
    definition: def,
    settings: { allowSelfTrigger: false, maxRunsPerHour: 60 },
    createdBy: "u1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    activatedAt: NOW.toISOString(),
    lastRunAt: null,
  };
}

function exec(w: Workflow): Execution {
  return {
    id: makeId(),
    workflowId: w.id,
    workflowName: w.name,
    triggerType: w.definition.nodes[0].type,
    triggerEventId: null,
    source: "manual",
    status: "running",
    dryRun: false,
    depth: 0,
    input: null,
    output: null,
    startedAt: NOW.toISOString(),
    completedAt: null,
    error: null,
    nodes: [],
    resume: null,
  };
}

function adapter(d = data()) {
  return createMemoryAdapter(d, { owner: "Joshua", ownerId: "u1", now: () => NOW, dryRun: false });
}

async function run(def: WorkflowDefinition, items: Item[], ws = adapter()) {
  const w = wf(def);
  const e = await executeWorkflow({ workflow: w, ws, execution: exec(w), items, makeId, sleep: async () => {} });
  return { e, ws };
}

async function main() {
  console.log("Registry");
  ok(NODE_DEFS.filter((d) => d.category === "trigger").length === 12, "12 triggers");
  ok(NODE_DEFS.filter((d) => d.category === "condition").length === 8, "8 conditions");
  ok(NODE_DEFS.filter((d) => d.category === "action").length === 12, "12 actions");
  ok(NODE_DEFS.filter((d) => d.category === "utility").length === 6, "6 utilities");
  for (const d of NODE_DEFS) {
    const errs = validateNodeConfig(d, d.defaults);
    ok(errs.length === 0 || d.type === "action.update_task", `defaults of ${d.type} validate (${errs.join("; ")})`);
    if (d.category !== "trigger") ok(typeof d.run === "function", `${d.type} has an executor`);
  }

  console.log("Templates");
  for (const t of TEMPLATES) {
    const def = t.build(makeId);
    const issues = validateWorkflow(def).filter((i) => i.level === "error");
    ok(issues.length === 0, `template ${t.id} is valid: ${issues.map((i) => i.message).join("; ")}`);
  }

  console.log("Validation");
  {
    const a = { id: "a", type: "trigger.manual", position: { x: 0, y: 0 }, config: {} };
    const b = { id: "b", type: "action.notify", position: { x: 0, y: 0 }, config: { title: "x", message: "" } };
    const c = { id: "c", type: "action.notify", position: { x: 0, y: 0 }, config: { title: "y", message: "" } };
    const cyc = validateWorkflow({
      nodes: [a, b, c],
      edges: [
        { id: "1", source: "a", target: "b" },
        { id: "2", source: "b", target: "c" },
        { id: "3", source: "c", target: "b" },
      ],
    });
    ok(cyc.some((i) => i.message.includes("loop")), "cycle detected");
    const noTrig = validateWorkflow({ nodes: [b], edges: [] });
    ok(noTrig.some((i) => i.message.includes("trigger")), "missing trigger detected");
    const badType = validateWorkflow({ nodes: [a, { ...b, type: "action.run_sql" }], edges: [] });
    ok(badType.some((i) => i.message.includes("Unknown step")), "unknown node type rejected");
    const badCond = validateWorkflow({
      nodes: [a, { id: "d", type: "condition.if_else", position: { x: 0, y: 0 }, config: { conditions: { match: "all", groups: [{ match: "all", conditions: [{ field: "constructor.prototype", operator: "equals", value: "" }] }] } } }],
      edges: [{ id: "1", source: "a", target: "d" }],
    });
    ok(badCond.some((i) => i.message.includes("Unknown field")), "unsafe field path rejected");
  }

  console.log("Templates interpolation");
  {
    const ws = adapter();
    const it: Item = { task: ws.getTask("t1"), vars: { x: 5 } };
    ok(renderTemplate("#{{task.code}} {{task.status}} {{vars.x}} {{sprint.name}}", it, ws) === "#41959 In Progress 5 Sprint 2", "template renders");
    ok(renderTemplate("{{constructor}}{{task.__proto__}}{{vars.__proto__}}", it, ws) === "", "no prototype access");
  }

  console.log("Template 2: overdue detection (schedule → AND condition → label → notify)");
  {
    const def = TEMPLATES.find((t) => t.id === "overdue-detection")!.build(makeId);
    const ws = adapter();
    const items = itemsForScope("open_tasks", ws);
    ok(items.length === 3, "3 open tasks");
    const { e } = await run(def, items, ws);
    ok(e.status === "success", `run succeeded (${e.error})`);
    const overdue = ws.data.tasks.filter((t) => t.labels?.includes("overdue")).map((t) => t.code).sort();
    ok(JSON.stringify(overdue) === JSON.stringify(["41959", "41962"]), `labelled overdue: ${overdue}`);
    ok(ws.notifications.length === 2, "2 notifications");
    const cond = e.nodes.find((x) => x.nodeType === "condition.and_or")!;
    ok(cond.branch?.true === 2 && cond.branch?.false === 1, "branch counts 2/1");
    ok(e.nodes.length === 4, "4 node records");
  }

  console.log("Template 5: high priority (TRUE and FALSE paths)");
  {
    const def = TEMPLATES.find((t) => t.id === "high-priority")!.build(makeId);
    const ws = adapter();
    const { e } = await run(def, [{ task: ws.getTask("t1"), vars: {} }], ws);
    ok(e.status === "success" && ws.notifications.length === 1, "high → notified");
    const ws2 = adapter();
    const r2 = await run(def, [{ task: ws2.getTask("t2"), vars: {} }], ws2);
    ok(r2.e.status === "success" && ws2.notifications.length === 0, "medium → not notified");
  }

  console.log("Template 4: sprint summary");
  {
    const def = TEMPLATES.find((t) => t.id === "sprint-summary")!.build(makeId);
    const ws = adapter();
    const { e } = await run(def, [{ sprint: ws.getSprint("s1"), vars: {} }], ws);
    ok(e.status === "success", `sprint summary ok (${e.error})`);
    ok(ws.notifications[0]?.message.startsWith("1 completed, 3 remaining."), `message: ${ws.notifications[0]?.message}`);
  }

  console.log("Actions");
  {
    const steps = [
      { type: "action.change_status", config: { status: "blocked", reason: "Waiting on {{task.code}}" } },
      { type: "action.assign_user", config: { assignee: "Maria" } },
      { type: "action.set_priority", config: { priority: "critical" } },
      { type: "action.update_deadline", config: { mode: "shift", days: 2 } },
      { type: "action.add_comment", config: { text: "Hello {{task.assignee}}" } },
      { type: "action.update_sprint_progress", config: { sprint: "item", note: "{{sprint.progress}}%" } },
      { type: "action.create_task", config: { title: "Follow up {{task.code}}", sprint: "item", dueInDays: 1, priority: "high", status: "todo" } },
    ];
    const nodes = [{ id: "trig", type: "trigger.manual", position: { x: 0, y: 0 }, config: {} }, ...steps.map((s, i) => ({ id: `n${i}`, type: s.type, position: { x: 0, y: 0 }, config: { ...NODE_BY_TYPE.get(s.type)!.defaults, ...s.config } }))];
    const edges = nodes.slice(1).map((nd, i) => ({ id: `e${i}`, source: nodes[i].id, target: nd.id, sourceHandle: "out" as const }));
    const ws = adapter();
    const { e } = await run({ nodes, edges }, [{ task: ws.getTask("t2"), vars: {} }], ws);
    ok(e.status === "success", `action chain ok (${e.error})`);
    const t2 = ws.getTask("t2")!;
    ok(t2.status === "blocked" && t2.blocker?.reason === "Waiting on 41960", "status + blocker reason");
    ok(t2.assignee === "Maria" && t2.priority === "critical" && t2.targetDate === "2026-11-15", "assign, priority, deadline");
    ok(t2.comments?.[0]?.text === "Hello Maria", "comment rendered with new assignee");
    ok(ws.getSprint("s1")!.progress?.percent === 25, "sprint progress saved");
    const created = ws.data.tasks.find((t) => t.title === "Follow up 41960");
    ok(!!created && created.code === "41963" && created.targetDate === "2026-11-13", "task created with next code");
  }

  console.log("Failure stops the run; retries");
  {
    let calls = 0;
    const ws = createMemoryAdapter(data(), {
      owner: "J",
      ownerId: "u1",
      now: () => NOW,
      dryRun: false,
      email: async () => {
        calls++;
        if (calls < 3) throw new NodeError("network", true);
        return { id: "m1", to: "me" };
      },
    });
    const def: WorkflowDefinition = {
      nodes: [
        { id: "a", type: "trigger.manual", position: { x: 0, y: 0 }, config: {} },
        { id: "b", type: "action.email", position: { x: 0, y: 0 }, config: { subject: "s", body: "b", retries: 2 } },
        { id: "c", type: "action.notify", position: { x: 0, y: 0 }, config: { title: "after", message: "" } },
      ],
      edges: [
        { id: "1", source: "a", target: "b" },
        { id: "2", source: "b", target: "c" },
      ],
    };
    const { e } = await run(def, [{ vars: {} }], ws);
    ok(e.status === "success" && calls === 3 && e.nodes[1].attempts === 3, "recoverable error retried until success");

    const ws2 = adapter();
    const bad: WorkflowDefinition = {
      nodes: [
        { id: "a", type: "trigger.manual", position: { x: 0, y: 0 }, config: {} },
        { id: "b", type: "action.set_priority", position: { x: 0, y: 0 }, config: { priority: "high" } },
        { id: "c", type: "action.notify", position: { x: 0, y: 0 }, config: { title: "never", message: "" } },
      ],
      edges: [
        { id: "1", source: "a", target: "b" },
        { id: "2", source: "b", target: "c" },
      ],
    };
    const r = await run(bad, [{ vars: {} }], ws2); // no task in item → set priority fails
    ok(r.e.status === "failed" && r.e.error?.includes("needs a task"), `fails with a clear error (${r.e.error})`);
    ok(ws2.notifications.length === 0, "later steps did not run");
    ok(r.e.nodes.at(-1)?.status === "failed", "failed node recorded");
  }

  console.log("Delay pauses and resumes");
  {
    const ws = adapter();
    const def: WorkflowDefinition = {
      nodes: [
        { id: "a", type: "trigger.manual", position: { x: 0, y: 0 }, config: {} },
        { id: "b", type: "utility.delay", position: { x: 0, y: 0 }, config: { amount: 2, unit: "hours" } },
        { id: "c", type: "action.notify", position: { x: 0, y: 0 }, config: { title: "later", message: "" } },
      ],
      edges: [
        { id: "1", source: "a", target: "b" },
        { id: "2", source: "b", target: "c" },
      ],
    };
    const w = wf(def);
    const e1 = await executeWorkflow({ workflow: w, ws, execution: exec(w), items: [{ vars: {} }], makeId });
    ok(e1.status === "waiting" && e1.resume?.queue[0].nodeId === "c", "waiting with saved queue");
    ok(new Date(e1.resume!.resumeAt).getTime() - NOW.getTime() === 2 * 3600_000, "resume time = +2h");
    ok(ws.notifications.length === 0, "nothing after the delay yet");
    const e2 = await executeWorkflow({ workflow: w, ws, execution: e1, makeId });
    ok(e2.status === "success" && ws.notifications.length === 1, "resumed and finished");
  }

  console.log("Utilities");
  {
    const ws = adapter();
    const def: WorkflowDefinition = {
      nodes: [
        { id: "a", type: "trigger.manual", position: { x: 0, y: 0 }, config: {} },
        { id: "f", type: "utility.filter", position: { x: 0, y: 0 }, config: { conditions: { match: "all", groups: [{ match: "any", conditions: [{ field: "task.priority", operator: "gt", value: "medium" }] }] } } },
        { id: "d", type: "utility.format_date", position: { x: 0, y: 0 }, config: { source: "task.targetDate", format: "relative", outputKey: "due" } },
        { id: "t", type: "utility.text", position: { x: 0, y: 0 }, config: { template: "#{{task.code}} due {{vars.due}}", transform: "upper", outputKey: "line" } },
        { id: "c", type: "utility.calculate", position: { x: 0, y: 0 }, config: { mode: "math", a: "{{task.estimateDays}}", operator: "multiply", b: "8", outputKey: "hours" } },
        { id: "m", type: "utility.merge", position: { x: 0, y: 0 }, config: { mode: "combine", outputKey: "merged" } },
        { id: "n", type: "action.notify", position: { x: 0, y: 0 }, config: { title: "{{vars.merged.count}} urgent", message: "{{vars.merged.text}}" } },
      ],
      edges: ["a-f", "f-d", "d-t", "t-c", "c-m", "m-n"].map((s, i) => ({ id: `e${i}`, source: s.split("-")[0], target: s.split("-")[1] })),
    };
    const { e } = await run(def, itemsForScope("all_tasks", ws), ws);
    ok(e.status === "success", `utility chain ok (${e.error})`);
    const tNode = e.nodes.find((x) => x.nodeId === "t")!.output as { items: { vars: { line: string } }[] };
    ok(tNode.items[0].vars.line === "#41959 DUE 2 DAYS AGO", `text formatter: ${tNode.items[0].vars.line}`);
    const cNode = e.nodes.find((x) => x.nodeId === "c")!.output as { items: { vars: { hours: number } }[] };
    ok(cNode.items[0].vars.hours === 8, "calculate");
    ok(ws.notifications[0]?.title === "2 urgent" && ws.notifications[0].message === "#41959 Retest login, #41962 Incident", `merge: ${ws.notifications[0]?.message}`);
  }

  console.log("Limits");
  {
    const ws = adapter();
    const many = Array.from({ length: 60 }, () => ({ task: ws.getTask("t1"), vars: {} }));
    const def: WorkflowDefinition = {
      nodes: [
        { id: "a", type: "trigger.manual", position: { x: 0, y: 0 }, config: {} },
        { id: "b", type: "action.set_priority", position: { x: 0, y: 0 }, config: { priority: "low" } },
      ],
      edges: [{ id: "1", source: "a", target: "b" }],
    };
    const { e } = await run(def, many, ws);
    ok(e.status === "failed" && /limit is 50/.test(e.error ?? ""), "action item cap enforced");
  }

  console.log("Schedules");
  {
    const from = new Date(2026, 10, 12, 10, 0); // Thu 10:00
    ok(nextRun({ frequency: "daily", time: "09:00" }, from).getTime() === new Date(2026, 10, 13, 9, 0).getTime(), "daily → tomorrow 9:00");
    ok(nextRun({ frequency: "daily", time: "11:30" }, from).getTime() === new Date(2026, 10, 12, 11, 30).getTime(), "daily → today 11:30");
    ok(nextRun({ frequency: "weekly", time: "09:00", weekday: 1 }, from).getTime() === new Date(2026, 10, 16, 9, 0).getTime(), "weekly → Monday");
    ok(nextRun({ frequency: "monthly", time: "09:00", dayOfMonth: 1 }, from).getTime() === new Date(2026, 11, 1, 9, 0).getTime(), "monthly → Dec 1");
    ok(nextRun({ frequency: "interval", intervalMinutes: 5 }, from).getTime() === from.getTime() + 15 * 60_000, "interval min 15");
  }

  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
