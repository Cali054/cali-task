"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { CATEGORY_LABELS, NODE_DEFS } from "@/lib/automation/nodes";
import type { NodeCategory } from "@/lib/automation/types";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR, NodeIcon } from "../shared";

export const DND_TYPE = "application/x-cali-node";

const ORDER: NodeCategory[] = ["trigger", "condition", "action", "utility"];

export function NodePalette({ onAdd, hasTrigger }: { onAdd: (type: string) => void; hasTrigger: boolean }) {
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Set<NodeCategory>>(new Set());
  const query = q.trim().toLowerCase();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <label className="glass-soft flex h-9 items-center gap-2 rounded-xl px-3">
          <Search className="size-3.5 text-fg-3" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-3"
            placeholder="Search steps"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search steps"
          />
        </label>
        <p className="mt-2 text-[11px] leading-snug text-fg-3">Drag a step onto the canvas, or click to add it after the selected step.</p>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {ORDER.map((cat) => {
          const items = NODE_DEFS.filter((d) => d.category === cat && (!query || d.label.toLowerCase().includes(query) || d.description.toLowerCase().includes(query)));
          if (!items.length) return null;
          const open = query.length > 0 || !closed.has(cat);
          const color = CATEGORY_COLOR[cat];
          return (
            <section key={cat} className="mb-1">
              <button
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color }}
                onClick={() =>
                  setClosed((s) => {
                    const n = new Set(s);
                    if (n.has(cat)) n.delete(cat);
                    else n.add(cat);
                    return n;
                  })
                }
                aria-expanded={open}
              >
                <span className="size-1.5 rounded-full" style={{ background: color }} />
                {CATEGORY_LABELS[cat]}
                <span className="ml-auto text-fg-3">{items.length}</span>
                <ChevronDown className={cn("size-3.5 text-fg-3 transition-transform", !open && "-rotate-90")} />
              </button>
              {open && (
                <ul className="space-y-1 pb-2">
                  {items.map((d) => (
                    <li key={d.type}>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DND_TYPE, d.type);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => onAdd(d.type)}
                        title={cat === "trigger" && hasTrigger ? "Replaces the current trigger" : d.description}
                        className="group flex w-full cursor-grab items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-[var(--glass-hover)] active:cursor-grabbing"
                      >
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-lg transition group-hover:scale-105"
                          style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                        >
                          <NodeIcon name={d.icon} className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{d.label}</span>
                          <span className="block truncate text-[11px] text-fg-3">{d.description}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
