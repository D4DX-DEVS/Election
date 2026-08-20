import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DeleteModeButtonProps {
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  /** Smaller icon button for dialogs and nested toolbars */
  compact?: boolean;
}

/** Icon-only toolbar button that toggles bulk-delete selection mode. */
export function DeleteModeButton({
  active = false,
  onClick,
  disabled = false,
  className,
  compact = false,
}: DeleteModeButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "destructive" : "outline"}
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={active ? "Cancel delete selection" : "Delete items"}
      title={active ? "Cancel selection" : "Delete"}
      className={cn(
        "shrink-0",
        compact ? "h-8 w-8" : "h-9 w-9",
        !active &&
          "border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
        active && "ring-2 ring-red-300 ring-offset-1",
        className
      )}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
