"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type IsValidConnection,
} from "@xyflow/react";
import { AlertCircle, ArrowLeft, FlaskConical, History, LayoutGrid, Loader2, Play, Plus, Save, X } from "lucide-react";
import { NODE_BY_TYPE } from "@/lib/automation/nodes";
import { validateWorkflow } from "@/lib/automation/validate";
import { runNow, saveWorkflow, setWorkflowStatus, testWorkflow } from "@/lib/automation/runtime";
import type { Execution, HandleId, WFNode, Workflow, WorkflowDefinition } from "@/lib/automation/types";
import { useAutomation } from "@/lib/automation/store";
import { useStore } from "@/lib/store";
import { cn, uid } from "@/lib/utils";
import { Button } from "@/components/ui/glass";
import { CanvasStatusContext, edgeTypes, nodeTypes, type FlowEdge, type FlowNode } from "./flow-parts";
import { ConfigPanel } from "./config-panel";
import { DND_TYPE, NodePalette } from "./palette";
import { CATEGORY_COLOR, ExecBadge, fmtDuration, Switch, WorkflowStatusPill } from "../shared";

const toFlowNodes = (d: WorkflowDefinition): FlowNode[] => d.nodes.map((n) => ({ id: n.id, type: "wf", position: n.position, data: { wf: n } }));
const toFlowEdges = (d: WorkflowDefinition): FlowEdge[] =>
  d.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? "out", type: "wf", animated: true }));

function toDefinition(nodes: FlowNode[], edges: FlowEdge[], viewport?: WorkflowDefinition["viewport"]): WorkflowDefinition {
  return {
    nodes: nodes.map((n) => ({ ...n.data.wf, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: (e.sourceHandle ?? "out") as HandleId })),
    ...(viewport ? { viewport } : {}),
  };
}

/** Comparable form (ignores viewport) for unsaved-change detection. */
const fingerprint = (d: WorkflowDefinition, name: string, description: string) =>
  JSON.stringify({ n: d.nodes, e: d.edges.map((e) => [e.source, e.target, e.sourceHandle ?? "out"]).sort(), name, description });

export function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  return (
    <ReactFlowProvider>
      <Editor workflow={workflow} />
    </ReactFlowProvider>
  );
}

function Editor({ workflow }: { workflow: Workflow }) {
  const router = useRouter();
  const rf = useReactFlow<FlowNode, FlowEdge>();
  const wrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(workflow.definition));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(toFlowEdges(workflow.definition));
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [saved, setSaved] = useState(() => fingerprint(workflow.definition, workflow.name, workflow.description));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelVersion, setPanelVersion] = useState(0);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "status" | "run" | null>(null);
  const [testRun, setTestRun] = useState<Execution | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const live = useAutomation((s) => s.workflows.find((w) => w.id === workflow.id)) ?? workflow;

  const definition = useMemo(() => toDefinition(nodes, edges), [nodes, edges]);
  const dirty = fingerprint(definition, name, description) !== saved;
  const issues = useMemo(() => validateWorkflow(definition), [definition]);
  const issueMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of issues) if (i.nodeId) m.set(i.nodeId, [...(m.get(i.nodeId) ?? []), i.message]);
    return m;
  }, [issues]);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const runMap = useMemo(() => {
    const m = new Map<string, { status: Execution["nodes"][number]["status"]; branch?: { true: number; false: number } | null }>();
    for (const n of testRun?.nodes ?? []) m.set(n.nodeId, { status: n.status, branch: n.branch });
    return m;
  }, [testRun]);
  const hasTrigger = nodes.some((n) => NODE_BY_TYPE.get(n.data.wf.type)?.category === "trigger");
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const flash = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3800);
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /* ---------- Building ---------- */

  const createNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      const def = NODE_BY_TYPE.get(type);
      if (!def) return;
      // One trigger per workflow: picking another trigger swaps it in place.
      const existingTrigger = nodes.find((n) => NODE_BY_TYPE.get(n.data.wf.type)?.category === "trigger");
      if (def.category === "trigger" && existingTrigger) {
        setNodes((ns) =>
          ns.map((n) => (n.id === existingTrigger.id ? { ...n, data: { wf: { ...n.data.wf, type, label: undefined, config: structuredClone(def.defaults) } } } : n)),
        );
        setSelectedId(existingTrigger.id);
        setPanelVersion((v) => v + 1);
        flash(`Trigger changed to ${def.label}.`);
        return;
      }
      const sel = nodes.find((n) => n.id === selectedId);
      let pos = position;
      if (!pos) {
        if (sel) pos = { x: sel.position.x + 290, y: sel.position.y + (edges.filter((e) => e.source === sel.id).length * 130) };
        else {
          const r = wrapper.current?.getBoundingClientRect();
          const c = r ? rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 };
          pos = { x: c.x - 116 + (nodes.length % 4) * 24, y: c.y - 50 + (nodes.length % 4) * 24 };
        }
      }
      const wf: WFNode = { id: uid(), type, position: pos, config: structuredClone(def.defaults) };
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id: wf.id, type: "wf", position: pos!, data: { wf }, selected: true }]);
      // Clicking a step with another selected chains it on.
      if (!position && sel && def.category !== "trigger") {
        const handle: HandleId = NODE_BY_TYPE.get(sel.data.wf.type)?.category === "condition" ? "true" : "out";
        setEdges((es) => [...es, { id: uid(), source: sel.id, target: wf.id, sourceHandle: handle, type: "wf", animated: true }]);
      }
      setSelectedId(wf.id);
      setPanelVersion((v) => v + 1);
      setPaletteOpen(false);
      // Keep the new step in view when it was placed automatically.
      if (!position) window.setTimeout(() => rf.fitView({ padding: 0.3, maxZoom: 1, duration: 300 }), 40);
    },
    [nodes, edges, selectedId, rf, setNodes, setEdges, flash],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(DND_TYPE);
      if (!type) return;
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      createNode(type, { x: p.x - 116, y: p.y - 40 });
    },
    [rf, createNode],
  );

  const isValidConnection: IsValidConnection<FlowEdge> = useCallback(
    (c) => {
      if (!c.source || !c.target || c.source === c.target) return false;
      const target = nodes.find((n) => n.id === c.target);
      if (!target || NODE_BY_TYPE.get(target.data.wf.type)?.category === "trigger") return false;
      if (edges.some((e) => e.source === c.source && e.target === c.target && (e.sourceHandle ?? "out") === (c.sourceHandle ?? "out"))) return false;
      // Reject loops: the source must not be reachable from the target.
      const seen = new Set<string>();
      const stack = [c.target];
      while (stack.length) {
        const id = stack.pop()!;
        if (id === c.source) return false;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const e of edges) if (e.source === id) stack.push(e.target);
      }
      return true;
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, id: uid(), sourceHandle: c.sourceHandle ?? "out", type: "wf", animated: true }, es)),
    [setEdges],
  );

  const applyConfig = (id: string, patch: { label: string; config: Record<string, unknown> }) => {
    const nextNodes = nodes.map((n) => (n.id === id ? { ...n, data: { wf: { ...n.data.wf, label: patch.label || undefined, config: patch.config } } } : n));
    setNodes(nextNodes);
    void persist(toDefinition(nextNodes, edges), "Step saved.");
  };

  const duplicateNode = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    const wf: WFNode = { ...structuredClone(n.data.wf), id: uid(), position: { x: n.position.x + 40, y: n.position.y + 120 } };
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), { id: wf.id, type: "wf", position: wf.position, data: { wf }, selected: true }]);
    setSelectedId(wf.id);
    setPanelVersion((v) => v + 1);
  };

  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  };

  const tidy = () => {
    // Simple left-to-right layout by depth from the trigger.
    const depth = new Map<string, number>();
    const trig = nodes.find((n) => NODE_BY_TYPE.get(n.data.wf.type)?.category === "trigger");
    const queue = trig ? [trig.id] : [];
    if (trig) depth.set(trig.id, 0);
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of edges.filter((x) => x.source === id)) {
        const d = (depth.get(id) ?? 0) + 1;
        if ((depth.get(e.target) ?? -1) < d) {
          depth.set(e.target, d);
          queue.push(e.target);
        }
      }
    }
    const rows = new Map<number, number>();
    setNodes((ns) =>
      ns.map((n) => {
        const d = depth.get(n.id) ?? Math.max(0, ...depth.values()) + 1;
        const r = rows.get(d) ?? 0;
        rows.set(d, r + 1);
        return { ...n, position: { x: d * 300, y: r * 150 } };
      }),
    );
    window.setTimeout(() => rf.fitView({ padding: 0.25, duration: 400 }), 30);
  };

  /* ---------- Saving, testing, activation ---------- */

  async function persist(def = definition, message = "Workflow saved.") {
    setBusy("save");
    const r = await saveWorkflow({ ...live, name, description, definition: { ...def, viewport: rf.getViewport() } });
    setBusy(null);
    if (!r.ok) {
      flash(r.error ?? "Couldn't save.", "error");
      return false;
    }
    setSaved(fingerprint(def, name, description));
    flash(message);
    return true;
  }

  async function toggleActive(on: boolean) {
    if (dirty && !(await persist())) return;
    setBusy("status");
    const r = await setWorkflowStatus(workflow.id, on ? "active" : "inactive");
    setBusy(null);
    if (!r.ok) flash(r.error ?? "Couldn't change status.", "error");
    else flash(on ? "Workflow is active." : "Workflow is off.");
  }

  async function runTest(dryRun: boolean, taskId: string | null) {
    setBusy("test");
    try {
      const r = await testWorkflow({ ...live, name, description, definition }, { dryRun, taskId });
      setTestRun(r);
      setTestOpen(true);
    } catch (e) {
      flash(`Test failed to start: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(null);
    }
  }

  const trigType = nodes.find((n) => NODE_BY_TYPE.get(n.data.wf.type)?.category === "trigger")?.data.wf.type;
  const canRunNow = (trigType === "trigger.manual" || trigType === "trigger.schedule") && live.status === "active";

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[560px] flex-col gap-3 lg:h-[calc(100dvh-9.5rem)]">
      {/* Toolbar */}
      <div className="glass flex flex-wrap items-center gap-2 rounded-[20px] p-2 pl-3">
        <button
          onClick={() => {
            if (dirty && !window.confirm("Leave without saving your changes?")) return;
            router.push("/automation");
          }}
          className="grid size-9 place-items-center rounded-xl text-fg-2 hover:bg-[var(--glass-soft)] hover:text-fg"
          aria-label="Back to Automation Center"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1 basis-48">
          <input
            className="w-full truncate bg-transparent text-[15px] font-semibold tracking-tight outline-none focus:text-accent"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            aria-label="Workflow name"
          />
          <input
            className="w-full truncate bg-transparent text-xs text-fg-3 outline-none placeholder:text-fg-3/70"
            value={description}
            maxLength={1000}
            placeholder="Add a description"
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Workflow description"
          />
        </div>
        <WorkflowStatusPill status={live.status} />
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-st-blocked/10 px-2.5 py-1 text-[11px] font-semibold text-st-blocked" title={issues.filter((i) => i.level === "error").map((i) => i.message).join("\n")}>
            <AlertCircle className="size-3" /> {errorCount} {errorCount === 1 ? "issue" : "issues"}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant={dirty ? "primary" : "glass"} onClick={() => void persist()} disabled={busy === "save"}>
            {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {dirty ? "Save" : "Saved"}
          </Button>
          <TestMenu onRun={runTest} busy={busy === "test"} trigType={trigType} />
          {canRunNow && (
            <Button
              size="sm"
              onClick={async () => {
                setBusy("run");
                const r = await runNow(workflow.id);
                setBusy(null);
                if (r) router.push(`/automation/runs/${r.id}`);
              }}
              disabled={busy === "run"}
            >
              <Play className="size-3.5" /> Run now
            </Button>
          )}
          <Link href={`/automation?tab=history&workflow=${workflow.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-fg-2 hover:bg-[var(--glass-soft)] hover:text-fg">
            <History className="size-3.5" /> <span className="hidden sm:inline">History</span>
          </Link>
          <label className="ml-1 flex items-center gap-2 rounded-xl px-2 text-xs font-medium text-fg-2">
            {live.status === "active" ? "Active" : "Activate"}
            <Switch checked={live.status === "active"} disabled={busy === "status"} onChange={(v) => void toggleActive(v)} label={live.status === "active" ? "Deactivate workflow" : "Activate workflow"} />
          </label>
        </div>
      </div>

      {/* Workspace */}
      <div className="relative flex min-h-0 flex-1 gap-3">
        <aside className={cn("glass hidden w-[248px] shrink-0 overflow-hidden rounded-[20px] lg:block")} aria-label="Steps">
          <NodePalette onAdd={(t) => createNode(t)} hasTrigger={hasTrigger} />
        </aside>

        <div ref={wrapper} className="wf-canvas glass-soft relative min-w-0 flex-1 overflow-hidden rounded-[20px]" onDragOver={(e) => (e.preventDefault(), (e.dataTransfer.dropEffect = "move"))} onDrop={onDrop}>
          <CanvasStatusContext.Provider value={{ issues: issueMap, run: runMap }}>
            <ReactFlow<FlowNode, FlowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onNodeClick={(_, n) => {
                if (n.id !== selectedId) setPanelVersion((v) => v + 1);
                setSelectedId(n.id);
              }}
              onPaneClick={() => setSelectedId(null)}
              onNodesDelete={(del) => del.some((d) => d.id === selectedId) && setSelectedId(null)}
              defaultViewport={workflow.definition.viewport ?? { x: 80, y: 160, zoom: 0.9 }}
              fitView={!workflow.definition.viewport && workflow.definition.nodes.length > 0}
              fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
              minZoom={0.25}
              maxZoom={1.75}
              defaultEdgeOptions={{ type: "wf", animated: true, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } }}
              deleteKeyCode={["Backspace", "Delete"]}
              proOptions={{ hideAttribution: true }}
              snapToGrid
              snapGrid={[12, 12]}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--wf-dot)" />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                className="!hidden sm:!block"
                nodeColor={(n) => CATEGORY_COLOR[NODE_BY_TYPE.get((n as FlowNode).data.wf.type)?.category ?? "action"]}
                nodeBorderRadius={8}
                maskColor="var(--wf-mask)"
              />
            </ReactFlow>
          </CanvasStatusContext.Provider>

          {/* Canvas controls */}
          <div className="absolute left-3 top-3 z-10 flex gap-1.5">
            <Button size="sm" variant="primary" className="lg:hidden" onClick={() => setPaletteOpen(true)}>
              <Plus className="size-3.5" /> Add step
            </Button>
            <Button size="sm" onClick={tidy} title="Arrange steps left to right">
              <LayoutGrid className="size-3.5" /> <span className="hidden sm:inline">Tidy up</span>
            </Button>
          </div>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
              <div className="glass pointer-events-auto max-w-sm rounded-[24px] p-6">
                <p className="text-sm font-semibold">Start with a trigger</p>
                <p className="mt-1 text-xs text-fg-3">Pick what starts this workflow — a task event, a schedule, or a manual run.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {["trigger.task_created", "trigger.task_completed", "trigger.schedule", "trigger.manual"].map((t) => (
                    <Button key={t} size="sm" onClick={() => createNode(t)}>
                      {NODE_BY_TYPE.get(t)!.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {testOpen && testRun && <TestResults run={testRun} onClose={() => setTestOpen(false)} onSelect={(id) => setSelectedId(id)} />}
          </AnimatePresence>
        </div>

        {/* Settings panel: docked on desktop, sliding over the canvas on smaller screens */}
        <AnimatePresence>
          {selected && (
            <motion.aside
              key="config"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className="glass-strong absolute inset-y-0 right-0 z-20 w-[min(340px,100%)] overflow-hidden rounded-[20px] xl:static xl:z-auto xl:w-[320px] xl:shrink-0"
              aria-label="Step settings"
            >
              <ConfigPanel
                key={`${selected.id}:${panelVersion}`}
                node={selected.data.wf}
                issues={issueMap.get(selected.id) ?? []}
                canDuplicate={NODE_BY_TYPE.get(selected.data.wf.type)?.category !== "trigger"}
                onApply={(p) => applyConfig(selected.id, p)}
                onDuplicate={() => duplicateNode(selected.id)}
                onDelete={() => deleteNode(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Palette drawer on smaller screens */}
        <AnimatePresence>
          {paletteOpen && (
            <>
              <motion.div className="fixed inset-0 z-40 bg-[rgba(8,7,5,0.5)] backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPaletteOpen(false)} />
              <motion.aside
                className="glass-strong fixed inset-y-3 left-3 z-50 w-[min(300px,calc(100vw-24px))] overflow-hidden rounded-[22px] bg-[var(--bg-sidebar)] lg:hidden"
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                aria-label="Add a step"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-sm font-semibold">Add a step</p>
                  <button onClick={() => setPaletteOpen(false)} className="grid size-8 place-items-center rounded-xl hover:bg-[var(--glass-soft)]" aria-label="Close">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="h-[calc(100%-57px)]">
                  <NodePalette onAdd={(t) => createNode(t)} hasTrigger={hasTrigger} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={cn(
              "glass-strong fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg",
              toast.tone === "error" ? "text-st-blocked" : "text-fg",
            )}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TestMenu({ onRun, busy, trigType }: { onRun: (dryRun: boolean, taskId: string | null) => void; busy: boolean; trigType?: string }) {
  const [open, setOpen] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const tasks = useStore((s) => s.tasks);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const usesTask = !!trigType && trigType.startsWith("trigger.task_");
  const [taskId, setTaskId] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const sorted = [...tasks].sort((a, b) => Number(b.sprintId === activeSprintId) - Number(a.sprintId === activeSprintId));
  return (
    <div className="relative" ref={ref}>
      <Button size="sm" onClick={() => setOpen((o) => !o)} disabled={busy} aria-expanded={open}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />} Test
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="glass-strong absolute right-0 top-10 z-30 w-[min(300px,calc(100vw-32px))] space-y-3 rounded-2xl p-4"
          >
            <p className="text-sm font-semibold">Test workflow</p>
            {usesTask && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-2">Sample task</span>
                <select className="field text-sm" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                  <option value="">First open task in the active sprint</option>
                  {sorted.slice(0, 80).map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.code} {t.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-xs font-medium text-fg-2">Mode</legend>
              <label className="flex items-start gap-2 text-xs">
                <input type="radio" name="mode" checked={dryRun} onChange={() => setDryRun(true)} className="mt-0.5 accent-[var(--accent)]" />
                <span>
                  <span className="font-medium">Dry run</span>
                  <span className="block text-fg-3">Runs on a copy — nothing changes, no notifications.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs">
                <input type="radio" name="mode" checked={!dryRun} onChange={() => setDryRun(false)} className="mt-0.5 accent-[var(--accent)]" />
                <span>
                  <span className="font-medium">Apply changes</span>
                  <span className="block text-fg-3">Really updates tasks and sends notifications.</span>
                </span>
              </label>
            </fieldset>
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false);
                onRun(dryRun, taskId || null);
              }}
            >
              <FlaskConical className="size-3.5" /> Run test
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TestResults({ run, onClose, onSelect }: { run: Execution; onClose: () => void; onSelect: (nodeId: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="glass-strong absolute inset-x-3 bottom-3 z-20 max-h-[45%] overflow-hidden rounded-[20px] sm:left-auto sm:w-[420px]"
      role="region"
      aria-label="Test results"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">{run.dryRun ? "Dry run" : "Test run"}</p>
        <ExecBadge status={run.status} />
        <Link href={`/automation/runs/${run.id}`} className="ml-auto text-xs font-medium text-accent">
          Details
        </Link>
        <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-fg-3 hover:text-fg" aria-label="Close test results">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="scroll-thin max-h-[calc(45vh-60px)] overflow-y-auto p-2">
        {run.error && <p className="mx-2 mb-2 rounded-xl bg-st-blocked/10 px-3 py-2 text-xs text-st-blocked">{run.error}</p>}
        {run.nodes.map((n) => {
          const out = n.output as { count?: number; detail?: unknown; true?: { count: number }; false?: { count: number } } | null;
          return (
            <button key={n.id} onClick={() => onSelect(n.nodeId)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--glass-hover)]">
              <ExecBadge status={n.status} className="w-[88px] justify-center" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{n.label}</span>
                <span className="block truncate text-[11px] text-fg-3">
                  {n.error ? n.error : n.branch ? `${n.branch.true} true · ${n.branch.false} false` : `${out?.count ?? 0} item(s) out`}
                </span>
              </span>
              <span className="text-[11px] tabular-nums text-fg-3">{fmtDuration(n.durationMs)}</span>
            </button>
          );
        })}
        {run.nodes.length <= 1 && !run.error && <p className="px-3 py-2 text-xs text-fg-3">Only the trigger ran — connect it to a step.</p>}
      </div>
    </motion.div>
  );
}
