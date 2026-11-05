"use client";

import { useRef, useState } from "react";
import { Database, Download, FlaskConical, ShieldCheck, Palette, Pencil, Plus, RotateCcw, Rocket, Sparkles, Trash2, Upload, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import type { AppData } from "@/lib/types";
import { MAX_BACKUP_BYTES, parseBackup } from "@/lib/backup";
import { fmtDate, fmtDateTime, today } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getShowIntro, setShowIntro } from "@/lib/prefs";
import Link from "next/link";
import { Button, CardHeader, Field, GlassCard, PageHeader } from "@/components/ui/glass";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ThemeSwitch } from "@/components/shell/topbar";

export default function SettingsPage() {
  const store = useStore();
  const { openSprintForm, setIntro } = useUI();
  const [name, setName] = useState(store.settings.userName);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSample, setConfirmSample] = useState(false);
  const [sprintToDelete, setSprintToDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAuth((s) => s.user);
  const [showIntro, setShowIntroState] = useState(getShowIntro);

  function exportData() {
    const data: AppData = {
      version: 1,
      tasks: store.tasks,
      sprints: store.sprints,
      activity: store.activity,
      activeSprintId: store.activeSprintId,
      settings: store.settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cali-task-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "ok", text: "Backup downloaded." });
  }

  async function importData(file: File) {
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("That file is too large to be a backup (max 5 MB).");
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      const data = parseBackup(raw, store.settings.userName);
      store.importData(data);
      setName(data.settings.userName);
      setMessage({ tone: "ok", text: `Imported ${data.tasks.length} tasks and ${data.sprints.length} sprints.` });
    } catch (e) {
      setMessage({ tone: "err", text: e instanceof Error ? e.message : "Import failed." });
    }
  }

  const sprintDel = store.sprints.find((s) => s.id === sprintToDelete);

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Personalize your workspace and manage your data." />
      {message && (
        <p className={`rounded-2xl px-4 py-2.5 text-sm ${message.tone === "ok" ? "bg-st-done/12 text-st-done" : "bg-st-blocked/12 text-st-blocked"}`}>
          {message.text}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <CardHeader title="Profile" subtitle="Shown in your welcome message" icon={UserRound} />
          {user && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="glass-soft rounded-2xl px-3 py-2.5">
                <dt className="text-[11px] text-fg-3">Account</dt>
                <dd className="truncate font-medium">{user.fullName}</dd>
                <dd className="truncate text-xs text-fg-2">@{user.username} · {user.email}</dd>
              </div>
              <div className="glass-soft rounded-2xl px-3 py-2.5">
                <dt className="flex items-center gap-1 text-[11px] text-fg-3"><ShieldCheck className="size-3" /> Consent recorded</dt>
                <dd className="font-medium">{fmtDateTime(user.consent.acceptedAt)}</dd>
                <dd className="text-xs text-fg-2">
                  <Link href="/privacy-policy" className="hover:text-accent hover:underline">Privacy</Link> &amp;{" "}
                  <Link href="/terms-and-conditions" className="hover:text-accent hover:underline">Terms</Link> v{user.consent.termsVersion}
                </dd>
              </div>
            </dl>
          )}
          <form
            className="mt-4 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              store.updateSettings({ userName: name.trim() || "Cali" });
              setMessage({ tone: "ok", text: "Profile saved." });
            }}
          >
            <Field label="Display name" className="flex-1">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary">Save</Button>
          </form>
        </GlassCard>

        <GlassCard className="p-5">
          <CardHeader title="Appearance" subtitle="Saved on this device" icon={Palette} />
          <div className="mt-4 space-y-4">
            <ThemeSwitch className="max-w-sm" />
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              <span>
                <span className="block font-medium">Intro animation</span>
                <span className="text-xs text-fg-3">Plays once per browser session. Reduced-motion settings are respected.</span>
              </span>
              <input
                type="checkbox"
                className="size-5 accent-[var(--accent)]"
                checked={showIntro}
                onChange={(e) => {
                  setShowIntroState(e.target.checked);
                  setShowIntro(e.target.checked);
                }}
              />
            </label>
            <Button size="sm" onClick={() => setIntro("show")}><Sparkles className="size-3.5" /> Replay intro</Button>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <CardHeader
          title="Sprints"
          subtitle={`${store.sprints.length} sprint${store.sprints.length > 1 ? "s" : ""}`}
          icon={Rocket}
          action={<Button size="sm" variant="primary" onClick={() => openSprintForm()}><Plus className="size-3.5" /> New sprint</Button>}
        />
        <ul className="mt-4 space-y-2">
          {store.sprints.map((s) => {
            const count = store.tasks.filter((t) => t.sprintId === s.id).length;
            const active = s.id === store.activeSprintId;
            return (
              <li key={s.id} className="glass-soft flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {s.name}
                    {active && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">Active</span>}
                  </p>
                  <p className="text-xs text-fg-3">
                    {fmtDate(s.startDate)} – {fmtDate(s.endDate)} · {count} tasks{s.targetLabel && ` · target ${s.targetLabel}`}
                  </p>
                </div>
                {!active && <Button size="sm" onClick={() => store.setActiveSprint(s.id)}>Set active</Button>}
                <Button size="icon" variant="ghost" className="size-8" onClick={() => openSprintForm(s.id)} aria-label={`Edit ${s.name}`}><Pencil className="size-4" /></Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 hover:text-st-blocked"
                  disabled={store.sprints.length <= 1}
                  onClick={() => setSprintToDelete(s.id)}
                  aria-label={`Delete ${s.name}`}
                  title={store.sprints.length <= 1 ? "You need at least one sprint" : undefined}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </GlassCard>

      <GlassCard className="p-5">
        <CardHeader title="Data" subtitle="Stored in this browser (localStorage). Export regularly to keep a backup." icon={Database} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={exportData}><Download className="size-4" /> Export JSON</Button>
          <Button onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Import JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => setConfirmSample(true)}>
            <FlaskConical className="size-4" /> Load sample data
          </Button>
          <Button variant="ghost" className="text-st-blocked" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" /> Clear workspace
          </Button>
        </div>
      </GlassCard>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Clear workspace?"
        text="All tasks, sprints and history will be deleted, leaving one empty sprint. Export first if you want a backup."
        confirmLabel="Clear"
        onConfirm={() => {
          store.resetData();
          setMessage({ tone: "ok", text: "Workspace cleared." });
        }}
      />
      <ConfirmDialog
        open={confirmSample}
        onOpenChange={setConfirmSample}
        title="Load sample data?"
        text="Your tasks, sprints and history will be replaced with the Sprint 2 example tasks. Export first if you want a backup."
        confirmLabel="Load sample"
        onConfirm={() => {
          store.loadSampleData();
          setMessage({ tone: "ok", text: "Sample Sprint 2 data loaded." });
        }}
      />
      <ConfirmDialog
        open={!!sprintToDelete}
        onOpenChange={(v) => !v && setSprintToDelete(null)}
        title={`Delete ${sprintDel?.name ?? "sprint"}?`}
        text={`This also deletes its ${store.tasks.filter((t) => t.sprintId === sprintToDelete).length} tasks.`}
        onConfirm={() => sprintToDelete && store.deleteSprint(sprintToDelete)}
      />
    </div>
  );
}
