import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** "destructive" shows a red accent + icon (default for delete actions). */
  variant?: "destructive" | "default";
  loading?: boolean;
}

/**
 * Reusable confirmation prompt used across the app for destructive or
 * irreversible actions (delete, remove, etc.). Provides a consistent,
 * beautiful design so individual pages don't reinvent the dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  loading = false,
}: ConfirmDialogProps) {
  const isDestructive = variant === "destructive";
  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent className="rounded-xl">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                isDestructive
                  ? "bg-red-100 text-red-600"
                  : "bg-[rgb(10,36,99)]/10 text-[rgb(10,36,99)]"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-1.5 pt-0.5">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="leading-relaxed">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={cn(
              isDestructive &&
                "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            )}
          >
            {loading ? "Please wait…" : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
