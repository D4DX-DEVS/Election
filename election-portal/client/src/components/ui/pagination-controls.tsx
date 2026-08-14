import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  /** Current page (1-based) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of records across all pages */
  total: number;
  /** Records per page */
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Reusable server-side pagination (Previous / Next + range summary).
 * Centered layout, intended to sit just above the fixed site footer.
 */
export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
}: PaginationControlsProps) {
  if (!total || total <= 0 || totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "shrink-0 w-full flex flex-col items-center justify-between gap-3 pt-1 pb-1 text-center sm:flex-row sm:text-left",
        className,
      )}
    >
      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{from}–{to}</span> of{" "}
        <span className="font-semibold text-slate-700">{total}</span>
      </p>
      <div className="flex items-center justify-center gap-2">
        <span className="mr-1 hidden text-sm text-slate-500 sm:inline">
          Page <span className="font-semibold text-slate-700">{page}</span> of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default PaginationControls;
