import { FIELD_BY_PATH, OPERATOR_VALUES, PRIORITY_LABELS, STATUS_LABELS } from "./fields";
import { NODE_BY_TYPE, type ConfigField, type NodeDef } from "./nodes";
import type { WFNode, WorkflowDefinition } from "./types";

export const MAX_NODES = 60;
export const MAX_EDGES = 150;

export interface Issue {
  nodeId: string | null;
  message: string;
  level: "error" | "warning";
}

function optionValues(f: Extract<ConfigField, { kind: "select" }>): string[] | null {
  if (f.options === "statuses") return Object.keys(STATUS_LABELS);
  if (f.options === "priorities") return Object.keys(PRIORITY_LABELS);
  if (f.options === "fields") return [...FIELD_BY_PATH.keys()];
  if (f.options === "sprints") return null; // checked at run time
  if (f.key === "operator" && f.options.length === 0) return OPERATOR_VALUES;
  return f.options.map((o) => o.value);
}

/** Checks one node's settings against its definition. Returns readable errors. */
export function validateNodeConfig(def: NodeDef, config: Record<string, unknown>): string[] {
  const errs: string[] = [];
  for (const f of def.fields) {
    if (f.showIf && !f.showIf(config)) continue;
    const v = config[f.key];
    switch (f.kind) {
      case "select": {
        const allowed = optionValues(f);
        if (allowed && v != null && v !== "" && !allowed.includes(String(v))) errs.push(`${f.label}: choose a valid option.`);
        break;
      }
      case "number": {
        if (v === "" || v == null) break;
        const n = Number(v);
        if (!Number.isFinite(n) || n < f.min || n > f.max) errs.push(`${f.label}: enter a number from ${f.min} to ${f.max}.`);
        break;
      }
      case "text":
      case "textarea": {
        const s = v == null ? "" : String(v);
        if (f.required && !s.trim()) errs.push(`${f.label} is required.`);
        if (s.length > (f.maxLength ?? 2000)) errs.push(`${f.label} is too long.`);
        break;
      }
      case "time":
        if (v && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) errs.push(`${f.label}: use HH:MM.`);
        break;
      case "date":
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errs.push(`${f.label}: pick a date.`);
        break;
      case "model":
        if (v && !/^[A-Za-z0-9][\w.\-:]{0,99}$/.test(String(v))) errs.push(`${f.label}: invalid model name.`);
        break;
    }
  }
  if (def.validate) errs.push(...def.validate(config));
  return [...new Set(errs)];
}

/**
 * Validates a whole workflow. Errors block saving as active and running;
 * warnings are shown but allowed.
 */
export function validateWorkflow(def: WorkflowDefinition): Issue[] {
  const issues: Issue[] = [];
  const err = (nodeId: string | null, message: string) => issues.push({ nodeId, message, level: "error" });
  const warn = (nodeId: string | null, message: string) => issues.push({ nodeId, message, level: "warning" });

  if (def.nodes.length > MAX_NODES) err(null, `Workflows can have at most ${MAX_NODES} steps.`);
  if (def.edges.length > MAX_EDGES) err(null, `Workflows can have at most ${MAX_EDGES} connections.`);

  const byId = new Map<string, WFNode>();
  for (const n of def.nodes) {
    if (byId.has(n.id)) err(n.id, "Duplicate step id.");
    byId.set(n.id, n);
  }

  const triggers = def.nodes.filter((n) => NODE_BY_TYPE.get(n.type)?.category === "trigger");
  if (triggers.length === 0) err(null, "Add a trigger to start the workflow.");
  if (triggers.length > 1) for (const t of triggers.slice(1)) err(t.id, "A workflow can only have one trigger.");

  for (const n of def.nodes) {
    const d = NODE_BY_TYPE.get(n.type);
    if (!d) {
      err(n.id, `Unknown step type "${n.type}".`);
      continue;
    }
    for (const m of validateNodeConfig(d, n.config ?? {})) err(n.id, m);
  }

  const out = new Map<string, string[]>();
  for (const e of def.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) {
      err(null, "A connection points to a missing step.");
      continue;
    }
    const sd = NODE_BY_TYPE.get(s.type);
    const td = NODE_BY_TYPE.get(t.type);
    if (td?.category === "trigger") err(t.id, "Triggers can't have incoming connections.");
    if (e.source === e.target) err(s.id, "A step can't connect to itself.");
    const handle = e.sourceHandle ?? "out";
    if (sd?.category === "condition" && handle !== "true" && handle !== "false") err(s.id, "Connect conditions from TRUE or FALSE.");
    if (sd && sd.category !== "condition" && handle !== "out") err(s.id, "Invalid connection handle.");
    out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  }

  // Cycles would make a workflow run forever.
  const state = new Map<string, 1 | 2>();
  let cycle = false;
  const visit = (id: string) => {
    if (cycle) return;
    state.set(id, 1);
    for (const nx of out.get(id) ?? []) {
      const st = state.get(nx);
      if (st === 1) {
        cycle = true;
        err(nx, "This connection creates a loop. Workflows must flow one way.");
        return;
      }
      if (!st) visit(nx);
    }
    state.set(id, 2);
  };
  for (const n of def.nodes) if (!state.has(n.id)) visit(n.id);

  // Reachability from the trigger.
  if (triggers[0]) {
    const seen = new Set<string>([triggers[0].id]);
    const stack = [triggers[0].id];
    while (stack.length) {
      for (const nx of out.get(stack.pop()!) ?? []) {
        if (seen.has(nx)) continue;
        seen.add(nx);
        stack.push(nx);
      }
    }
    for (const n of def.nodes) if (!seen.has(n.id)) warn(n.id, "Not connected to the trigger, so it never runs.");
    if (seen.size === 1 && def.nodes.length >= 1) warn(triggers[0].id, "Connect the trigger to at least one step.");
  }
  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === "error");
