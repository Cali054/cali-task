"use client";

import { createContext, memo, useContext } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { AlertCircle, X } from "lucide-react";
import { NODE_BY_TYPE } from "@/lib/automation/nodes";
import type { NodeExecStatus, WFNode } from "@/lib/automation/types";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR, CATEGORY_NAME, execColor, NodeIcon } from "../shared";

export type FlowNodeData = { wf: WFNode };
export type FlowNode = Node<FlowNodeData, "wf">;
export type FlowEdge = Edge<Record<string, never>, "wf">;

/** Per-node validation issues and last test results, shared without re-creating nodes. */
export interface CanvasStatus {
  issues: Map<string, string[]>;
  run: Map<string, { status: NodeExecStatus; branch?: { true: number; false: number } | null }>;
}
export const CanvasStatusContext = createContext<CanvasStatus>({ issues: new Map(), run: new Map() });

function HandleDot({
  type,
  position,
  id,
  color,
  label,
  style,
}: {
  type: "source" | "target";
  position: Position;
  id?: string;
  color: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Handle
      type={type}
      position={position}
      id={id}
      className="wf-handle"
      style={{ ...style, ["--h" as string]: color }}
      aria-label={label ? `${label} output` : type === "target" ? "Input" : "Output"}
    >
      {label && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-wider" style={{ color }}>
          {label}
        </span>
      )}
    </Handle>
  );
}

export const WorkflowNode = memo(function WorkflowNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { issues, run } = useContext(CanvasStatusContext);
  const def = NODE_BY_TYPE.get(data.wf.type);
  if (!def) return <div className="glass rounded-2xl p-3 text-xs text-st-blocked">Unknown step</div>;
  const color = CATEGORY_COLOR[def.category];
  const nodeIssues = issues.get(id) ?? [];
  const result = run.get(id);
  const summary = def.summary?.(data.wf.config ?? {});

  return (
    <div
      className={cn(
        "wf-node glass relative w-[232px] rounded-[20px] p-3.5 transition-shadow",
        selected && "wf-node-selected",
        result?.status === "failed" && "ring-2 ring-st-blocked/70",
      )}
      style={{ ["--cat" as string]: color }}
    >
      <span aria-hidden className="absolute inset-x-5 top-0 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
          <NodeIcon name={def.icon} className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
            {CATEGORY_NAME[def.category]}
          </p>
          <p className="truncate text-[13px] font-semibold leading-tight">{data.wf.label || def.label}</p>
        </div>
        {result && (
          <span
            className="mt-0.5 size-2.5 shrink-0 rounded-full"
            title={`Last test: ${result.status}`}
            style={{ background: execColor(result.status), boxShadow: `0 0 10px ${execColor(result.status)}` }}
          />
        )}
      </div>
      {summary && <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-fg-3">{summary}</p>}
      {def.category === "condition" && result?.branch && (
        <p className="mt-1.5 text-[10px] text-fg-3">
          <span className="text-st-done">{result.branch.true} true</span> · <span className="text-st-blocked">{result.branch.false} false</span>
        </p>
      )}
      {nodeIssues.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-st-blocked" title={nodeIssues.join("\n")}>
          <AlertCircle className="size-3" /> {nodeIssues.length === 1 ? nodeIssues[0] : `${nodeIssues.length} issues`}
        </p>
      )}

      {def.category !== "trigger" && <HandleDot type="target" position={Position.Left} color="var(--fg-3)" />}
      {def.category === "condition" ? (
        <>
          <HandleDot type="source" position={Position.Right} id="true" color="var(--st-done)" label="TRUE" style={{ top: "34%" }} />
          <HandleDot type="source" position={Position.Right} id="false" color="var(--st-blocked)" label="FALSE" style={{ top: "72%" }} />
        </>
      ) : (
        <HandleDot type="source" position={Position.Right} id="out" color={color} />
      )}
    </div>
  );
});

export function WorkflowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, sourceHandleId, selected, markerEnd }: EdgeProps<FlowEdge>) {
  const { setEdges } = useReactFlow();
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const color = sourceHandleId === "true" ? "var(--st-done)" : sourceHandleId === "false" ? "var(--st-blocked)" : "var(--accent)";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className="wf-edge"
        style={{ stroke: color, strokeWidth: selected ? 2.6 : 1.8, opacity: selected ? 1 : 0.85, filter: selected ? `drop-shadow(0 0 6px ${color})` : undefined }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan glass-strong pointer-events-auto absolute grid size-6 place-items-center rounded-full text-fg-2 hover:text-st-blocked"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
            onClick={() => setEdges((es) => es.filter((e) => e.id !== id))}
            aria-label="Remove connection"
          >
            <X className="size-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const nodeTypes = { wf: WorkflowNode };
export const edgeTypes = { wf: WorkflowEdge };
