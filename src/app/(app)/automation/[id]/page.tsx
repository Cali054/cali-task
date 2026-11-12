"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Workflow as WorkflowIcon } from "lucide-react";
import { useAutomation } from "@/lib/automation/store";
import { WorkflowEditor } from "@/components/automation/editor/workflow-editor";
import { CaliLoadingIndicator } from "@/components/brand/cali-logo";
import { EmptyState, GlassCard } from "@/components/ui/glass";

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const ready = useAutomation((s) => s.boundTo !== null && s.cloud !== "loading");
  const workflow = useAutomation((s) => s.workflows.find((w) => w.id === id));

  if (!ready) return <CaliLoadingIndicator />;
  if (!workflow)
    return (
      <GlassCard>
        <EmptyState
          icon={WorkflowIcon}
          title="Workflow not found"
          text="It may have been deleted, or it belongs to another account."
          action={
            <Link href="/automation" className="text-sm font-medium text-accent">
              Back to Automation Center
            </Link>
          }
        />
      </GlassCard>
    );
  return <WorkflowEditor key={workflow.id} workflow={workflow} />;
}
