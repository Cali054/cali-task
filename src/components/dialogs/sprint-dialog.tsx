"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { addWorkingDays, nextWorkingDay, today, addDays } from "@/lib/utils";
import { GlassDialog } from "@/components/ui/dialog";
import { Button, Field } from "@/components/ui/glass";

export function SprintDialog() {
  const session = useUI((s) => s.session);
  return <SprintDialogInner key={session} />;
}

function SprintDialogInner() {
  const { open, editId } = useUI((s) => s.sprintForm);
  const close = useUI((s) => s.closeSprintForm);
  const sprints = useStore((s) => s.sprints);
  const addSprint = useStore((s) => s.addSprint);
  const updateSprint = useStore((s) => s.updateSprint);
  const editing = editId ? sprints.find((s) => s.id === editId) : undefined;

  const [defaults] = useState(() => {
    if (editing) return editing;
    const last = [...sprints].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1);
    const start = nextWorkingDay(last && last.endDate >= today() ? addDays(last.endDate, 1) : today());
    const lastNo = Math.max(0, ...sprints.map((x) => Number(/(\d+)\s*$/.exec(x.name)?.[1] ?? 0)));
    return {
      name: `Sprint ${lastNo + 1}`,
      goal: "",
      startDate: start,
      endDate: addWorkingDays(start, 10),
      targetLabel: "",
      targetDaysMin: null as number | null,
      targetDaysMax: null as number | null,
    };
  });
  const [name, setName] = useState(defaults.name);
  const [goal, setGoal] = useState(defaults.goal);
  const [start, setStart] = useState(defaults.startDate);
  const [end, setEnd] = useState(defaults.endDate);
  const [targetLabel, setTargetLabel] = useState(defaults.targetLabel);
  const [tMin, setTMin] = useState(defaults.targetDaysMin?.toString() ?? "");
  const [tMax, setTMax] = useState(defaults.targetDaysMax?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Sprint name is required.");
    if (!start || !end || end < start) return setError("End date must be on or after the start date.");
    const data = {
      name: name.trim(),
      goal: goal.trim(),
      startDate: start,
      endDate: end,
      targetLabel: targetLabel.trim(),
      targetDaysMin: tMin ? Number(tMin) : null,
      targetDaysMax: tMax ? Number(tMax) : tMin ? Number(tMin) : null,
    };
    if (editing) updateSprint(editing.id, data);
    else addSprint(data);
    close();
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={(v) => !v && close()}
      title={editing ? `Edit ${editing.name}` : "New sprint"}
      description={editing ? undefined : "The new sprint becomes your active sprint."}
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-st-blocked">{error}</p>}
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form="sprint-form">{editing ? "Save sprint" : "Create sprint"}</Button>
        </>
      }
    >
      <form id="sprint-form" onSubmit={submit} className="grid gap-4 pb-2 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Goal" className="sm:col-span-2">
          <input className="field" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What does this sprint deliver?" />
        </Field>
        <Field label="Start date">
          <input className="field" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="End date">
          <input className="field" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Committed target" className="sm:col-span-2" hint="Shown next to the sum of task estimates so any gap is visible.">
          <input className="field" value={targetLabel} onChange={(e) => setTargetLabel(e.target.value)} placeholder="e.g. 2–3 days + testing" />
        </Field>
        <Field label="Target min (days)">
          <input className="field" type="number" min="0" step="0.5" value={tMin} onChange={(e) => setTMin(e.target.value)} />
        </Field>
        <Field label="Target max (days)">
          <input className="field" type="number" min="0" step="0.5" value={tMax} onChange={(e) => setTMax(e.target.value)} />
        </Field>
      </form>
    </GlassDialog>
  );
}
