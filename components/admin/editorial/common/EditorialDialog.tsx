"use client";

import type { ComponentProps, ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import styles from "../editorial.module.css";

/**
 * A confirmation dialog on the editorial palette. Radix traps focus, closes
 * on Escape and returns focus; callers that open it from a menu pass
 * `onCloseAutoFocus` to send focus back to a stable control.
 */
export function EditorialDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onCloseAutoFocus,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children: ReactNode;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          styles.theme,
          "max-h-[calc(100dvh-2rem)] overflow-y-auto border-(--ed-border-strong) bg-(--ed-surface) text-(--ed-text) sm:max-w-xl",
          className,
        )}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg leading-snug">{title}</DialogTitle>
          <DialogDescription className="text-sm text-(--ed-text-2)">{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
