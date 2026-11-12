"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Copy, Plus, Save, Trash2, X } from "lucide-react";
import { FIELDS, fieldKind, OPERATORS, PRIORITY_LABELS, STATUS_LABELS, type Condition, type ConditionSet } from "@/lib/automation/fields";
import { NODE_BY_TYPE, type ConfigField } from "@/lib/automation/nodes";
import { validateNodeConfig } from "@/lib/automation/validate";
import type { WFNode } from "@/lib/automation/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/glass";
import { CATEGORY_COLOR, CATEGORY_NAME, NodeIcon, Switch } from "../shared";

const TOKENS = [
  ["{{task.code}}", "Task ID"],
  ["{{task.title}}", "Task title"],
  ["{{task.status}}", "Status"],
  ["{{task.priority}}", "Priority"],
  ["{{task.assignee}}", "Assignee"],
  ["{{task.targetDate}}", "Due date"],
  ["{{task.daysUntilDue}}", "Days until due"],
  ["{{sprint.name}}", "Sprint name"],
  ["{{sprint.progress}}", "Sprint progress %"],
  ["{{sprint.completedTasks}}", "Completed tasks"],
  ["{{sprint.remainingTasks}}", "Remaining tasks"],
  ["{{owner.name}}", "Your name"],
  ["{{today}}", "Today's date"],
];

export function ConfigPanel({
  node,
  issues,
  onApply,
  onDuplicate,
  onDelete,
  onClose,
  canDuplicate,
}: {
  node: WFNode;
  issues: string[];
  onApply: (patch: { label: string; config: Record<string, unknown> }) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  canDuplicate: boolean;
}) {
  const def = NODE_BY_TYPE.get(node.type)!;
  const [label, setLabel] = useState(node.label ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>(() => ({ ...def.defaults, ...structuredClone(node.config ?? {}) }));
  const errors = useMemo(() => validateNodeConfig(def, config), [def, config]);
  const dirty = label !== (node.label ?? "") || JSON.stringify(config) !== JSON.stringify({ ...def.defaults, ...(node.config ?? {}) });
  const set = (k: string, v: unknown) => setConfig((c) => ({ ...c, [k]: v }));
  const color = CATEGORY_COLOR[def.category];
  const otherIssues = issues.filter((i) => !errors.includes(i));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
          <NodeIcon name={def.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
            {CATEGORY_NAME[def.category]}
          </p>
          <h2 className="truncate text-[15px] font-semibold">{def.label}</h2>
        </div>
        <button onClick={onClose} className="grid size-8 place-items-center rounded-xl text-fg-3 hover:bg-[var(--glass-soft)] hover:text-fg" aria-label="Close settings">
          <X className="size-4" />
        </button>
      </div>

      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs leading-relaxed text-fg-2">{def.description}</p>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-2">Step name</span>
          <input className="field" value={label} maxLength={60} placeholder={def.label} onChange={(e) => setLabel(e.target.value)} />
        </label>

        {def.fields.map((f) =>
          f.showIf && !f.showIf(config) ? null : <FieldInput key={f.key} field={f} value={config[f.key]} onChange={(v) => set(f.key, v)} config={config} />,
        )}

        {def.fields.length === 0 && <p className="text-xs text-fg-3">This step has no settings.</p>}

        {(errors.length > 0 || otherIssues.length > 0) && (
          <div className="space-y-1 rounded-2xl bg-st-blocked/10 p-3">
            {[...errors, ...otherIssues].map((e) => (
              <p key={e} className="flex items-start gap-1.5 text-xs text-st-blocked">
                <AlertCircle className="mt-0.5 size-3 shrink-0" /> {e}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-line p-4">
        <Button variant="primary" className="w-full" disabled={errors.length > 0 && !dirty} onClick={() => onApply({ label: label.trim(), config })}>
          <Save className="size-4" /> Save configuration
        </Button>
        <div className="flex gap-2">
          {canDuplicate && (
            <Button size="sm" className="flex-1" onClick={onDuplicate}>
              <Copy className="size-3.5" /> Duplicate
            </Button>
          )}
          <Button size="sm" variant="ghost" className="flex-1 hover:text-st-blocked" onClick={onDelete}>
            <Trash2 className="size-3.5" /> Delete step
          </Button>
        </div>
        {dirty && <p className="text-center text-[11px] text-fg-3">You have unsaved changes to this step.</p>}
      </div>
    </div>
  );
}

function FieldInput({
  field: f,
  value,
  onChange,
  config,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
  config: Record<string, unknown>;
}) {
  const sprints = useStore((s) => s.sprints);
  const label = (
    <span className="text-xs font-medium text-fg-2">
      {f.label}
      {"required" in f && f.required && <span className="text-st-blocked"> *</span>}
    </span>
  );
  const help = f.help ? <span className="text-[11px] leading-snug text-fg-3">{f.help}</span> : null;

  switch (f.kind) {
    case "select": {
      let opts: { value: string; label: string; group?: string }[];
      if (f.options === "statuses") opts = Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));
      else if (f.options === "priorities") opts = Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));
      else if (f.options === "sprints") opts = sprints.map((s) => ({ value: s.id, label: s.name }));
      else if (f.options === "fields") opts = FIELDS.map((x) => ({ value: x.path, label: x.label, group: x.group }));
      else if (f.key === "operator" && f.options.length === 0) opts = [...OPERATORS];
      else opts = f.options;
      const groups = [...new Set(opts.map((o) => o.group).filter(Boolean))] as string[];
      return (
        <label className="flex flex-col gap-1.5">
          {label}
          <select className="field" value={String(value ?? "")} onChange={(e) => onChange(f.key === "weekday" ? Number(e.target.value) : e.target.value)}>
            {groups.length
              ? groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {opts.filter((o) => o.group === g).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))
              : opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
          </select>
          {help}
        </label>
      );
    }
    case "text":
    case "textarea": {
      const Tag = f.kind === "textarea" ? "textarea" : "input";
      return (
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5">
            {label}
            <Tag
              className={cn("field", f.kind === "textarea" && "min-h-20 resize-y")}
              value={String(value ?? "")}
              placeholder={f.placeholder}
              maxLength={f.maxLength}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
            />
          </label>
          {f.template && (
            <select
              className="field h-8 py-0 text-xs text-fg-2"
              value=""
              aria-label={`Insert a value into ${f.label}`}
              onChange={(e) => e.target.value && onChange(`${String(value ?? "")}${e.target.value}`)}
            >
              <option value="">Insert value…</option>
              {TOKENS.map(([t, l]) => (
                <option key={t} value={t}>
                  {l} — {t}
                </option>
              ))}
            </select>
          )}
          {help}
        </div>
      );
    }
    case "number":
      return (
        <label className="flex flex-col gap-1.5">
          {label}
          <input
            type="number"
            className="field"
            min={f.min}
            max={f.max}
            step={f.step ?? 1}
            value={value === "" || value == null ? "" : Number(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          />
          {help}
        </label>
      );
    case "time":
      return (
        <label className="flex flex-col gap-1.5">
          {label}
          <input type="time" className="field" value={String(value ?? "09:00")} onChange={(e) => onChange(e.target.value)} />
          {help}
        </label>
      );
    case "date":
      return (
        <label className="flex flex-col gap-1.5">
          {label}
          <input type="date" className="field" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
          {help}
        </label>
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between gap-3">
          {label}
          <Switch checked={Boolean(value)} onChange={onChange} label={f.label} />
        </div>
      );
    case "keyvalue": {
      const rows = (Array.isArray(value) ? value : []) as { key: string; value: string }[];
      const update = (next: { key: string; value: string }[]) => onChange(next);
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          {rows.map((r, i) => (
            <div key={i} className="flex gap-1.5">
              <input className="field w-28 font-mono text-xs" value={r.key} placeholder="name" onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
              <input className="field min-w-0 flex-1 text-xs" value={r.value} placeholder="value or {{task.title}}" onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <button className="grid size-10 shrink-0 place-items-center rounded-xl text-fg-3 hover:text-st-blocked" onClick={() => update(rows.filter((_, j) => j !== i))} aria-label="Remove value">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="self-start" onClick={() => update([...rows, { key: "", value: "" }])}>
            <Plus className="size-3.5" /> Add value
          </Button>
          {help}
        </div>
      );
    }
    case "conditions":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <ConditionsEditor value={(value as ConditionSet) ?? { match: "all", groups: [] }} onChange={onChange} />
          {help}
        </div>
      );
  }
  void config;
  return null;
}

const blankCondition = (): Condition => ({ field: "task.status", operator: "equals", value: "completed" });

export function ConditionsEditor({ value, onChange }: { value: ConditionSet; onChange: (v: ConditionSet) => void }) {
  const set = value?.groups ? value : { match: "all" as const, groups: [] };
  const update = (groups: ConditionSet["groups"], match = set.match) => onChange({ match, groups });

  return (
    <div className="space-y-2">
      {set.groups.map((g, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <div className="my-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-[var(--glass-line)]" />
              <select
                className="field h-7 w-auto rounded-lg px-2 py-0 text-[11px] font-semibold uppercase tracking-wider text-accent"
                value={set.match}
                onChange={(e) => update(set.groups, e.target.value as "all" | "any")}
                aria-label="Combine groups with"
              >
                <option value="all">AND</option>
                <option value="any">OR</option>
              </select>
              <span className="h-px flex-1 bg-[var(--glass-line)]" />
            </div>
          )}
          <div className="glass-soft space-y-2 rounded-2xl p-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] text-fg-3">
                Match
                <select
                  className="field h-7 w-auto rounded-lg px-2 py-0 text-[11px]"
                  value={g.match}
                  onChange={(e) => update(set.groups.map((x, i) => (i === gi ? { ...x, match: e.target.value as "all" | "any" } : x)))}
                >
                  <option value="all">all (AND)</option>
                  <option value="any">any (OR)</option>
                </select>
              </label>
              {set.groups.length > 1 && (
                <button className="text-[11px] text-fg-3 hover:text-st-blocked" onClick={() => update(set.groups.filter((_, i) => i !== gi))}>
                  Remove group
                </button>
              )}
            </div>
            {g.conditions.map((c, ci) => (
              <ConditionRow
                key={ci}
                c={c}
                onChange={(nc) => update(set.groups.map((x, i) => (i === gi ? { ...x, conditions: x.conditions.map((y, j) => (j === ci ? nc : y)) } : x)))}
                onRemove={() => update(set.groups.map((x, i) => (i === gi ? { ...x, conditions: x.conditions.filter((_, j) => j !== ci) } : x)))}
              />
            ))}
            <button
              className="flex items-center gap-1 text-[11px] font-medium text-accent"
              onClick={() => update(set.groups.map((x, i) => (i === gi ? { ...x, conditions: [...x.conditions, blankCondition()] } : x)))}
            >
              <Plus className="size-3" /> Add condition
            </button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => update([...set.groups, { match: "all", conditions: [blankCondition()] }])}>
        <Plus className="size-3.5" /> Add group
      </Button>
    </div>
  );
}

function ConditionRow({ c, onChange, onRemove }: { c: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  const kind = fieldKind(c.field);
  const needsValue = c.operator !== "empty" && c.operator !== "not_empty";
  const groups = [...new Set(FIELDS.map((f) => f.group))];
  return (
    <div className="space-y-1.5 rounded-xl bg-[var(--glass-line)]/40 p-2">
      <div className="flex gap-1.5">
        <select
          className="field h-8 min-w-0 flex-1 py-0 text-xs"
          value={c.field}
          aria-label="Field"
          onChange={(e) => {
            const k = fieldKind(e.target.value);
            onChange({
              ...c,
              field: e.target.value,
              value: k === "status" ? "completed" : k === "priority" ? "high" : k === "boolean" ? "true" : k === "date" ? "today" : "",
            });
          }}
        >
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {FIELDS.filter((f) => f.group === g).map((f) => (
                <option key={f.path} value={f.path}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
          {!FIELDS.some((f) => f.path === c.field) && <option value={c.field}>{c.field}</option>}
        </select>
        <button className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 hover:text-st-blocked" onClick={onRemove} aria-label="Remove condition">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-1.5">
        <select className="field h-8 w-[44%] py-0 text-xs" value={c.operator} aria-label="Operator" onChange={(e) => onChange({ ...c, operator: e.target.value as Condition["operator"] })}>
          {OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {needsValue &&
          (kind === "status" || kind === "priority" || kind === "boolean" ? (
            <select className="field h-8 min-w-0 flex-1 py-0 text-xs" value={c.value} aria-label="Value" onChange={(e) => onChange({ ...c, value: e.target.value })}>
              {Object.entries(kind === "status" ? STATUS_LABELS : kind === "priority" ? PRIORITY_LABELS : { true: "Yes", false: "No" }).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="field h-8 min-w-0 flex-1 py-0 text-xs"
              value={c.value}
              aria-label="Value"
              inputMode={kind === "number" ? "decimal" : undefined}
              placeholder={kind === "date" ? "today, today+3, 2026-12-01" : "value"}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
            />
          ))}
      </div>
    </div>
  );
}
