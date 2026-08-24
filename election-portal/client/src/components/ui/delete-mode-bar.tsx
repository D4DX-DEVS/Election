import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteModeBarProps {
  active: boolean;
  count: number;
  entityLabel: string;
  onCancel: () => void;
  onConfirmDelete: () => void;
  deleting?: boolean;
}

/** Shown while bulk-delete mode is active (after user taps Delete in the toolbar). */
export function DeleteModeBar({
  active,
  count,
  entityLabel,
  onCancel,
  onConfirmDelete,
  deleting = false,
}: DeleteModeBarProps) {
  if (!active) return null;

  const label = count === 1 ? entityLabel : `${entityLabel}s`;

  return (
    <div className="mb-2 flex flex-col gap-2 rounded-md border border-red-200/80 bg-red-50/70 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="app-body font-medium text-red-900">
        {count > 0
          ? `${count} ${label} selected`
          : `Select ${label} to delete`}
      </p>
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={deleting}
          className="h-7 px-2 text-xs"
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onConfirmDelete}
          disabled={deleting || count === 0}
          className="h-7 px-2 text-xs"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          {deleting ? "Deleting…" : count > 0 ? `Delete (${count})` : "Delete"}
        </Button>
      </div>
    </div>
  );
}
