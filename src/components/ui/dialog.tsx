"use client";

import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./glass";

export function GlassDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[rgba(8,7,5,0.5)] backdrop-blur-sm dark:bg-black/50" />
        <D.Content
          className={cn(
            "dialog-content glass-strong fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,820px)] w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-[28px] focus:outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div className="min-w-0">
              <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-sm text-fg-2">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">Dialog</D.Description>
              )}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-9" aria-label="Close">
                <X className="size-4" />
              </Button>
            </D.Close>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  text,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  text: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="max-w-sm"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-2">{text}</p>
    </GlassDialog>
  );
}
