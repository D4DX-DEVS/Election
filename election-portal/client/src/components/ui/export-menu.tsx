import { FileSpreadsheet, FileText, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onPrintSlips?: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
  label?: string;
  /** Compact sizing for card footers and tight toolbars */
  compact?: boolean;
  /** Icon-only trigger (no label text) */
  iconOnly?: boolean;
  /** Icon-only below sm; show label from sm breakpoint up */
  iconOnlyOnMobile?: boolean;
}

export function ExportMenu({
  onExportPdf,
  onExportExcel,
  onPrintSlips,
  disabled = false,
  className,
  size = "sm",
  label = "Export",
  compact = false,
  iconOnly = false,
  iconOnlyOnMobile = false,
}: ExportMenuProps) {
  const hasPdf = !!onExportPdf;
  const hasExcel = !!onExportExcel;
  const hasPrint = !!onPrintSlips;
  if (!hasPdf && !hasExcel && !hasPrint) return null;

  const showLabel = !iconOnly;
  const responsive = iconOnlyOnMobile && !iconOnly;

  const defaultClass = iconOnly
    ? "h-9 w-9 shrink-0 p-0"
    : responsive
      ? "h-9 w-9 shrink-0 p-0 sm:h-9 sm:w-auto sm:px-3"
      : compact
        ? "h-8 w-full min-w-0 justify-center gap-1.5 px-2.5 text-xs font-medium leading-none"
        : "h-9 w-full justify-center px-2 sm:w-auto sm:px-3";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={iconOnly ? "icon" : size}
          disabled={disabled}
          className={className ?? defaultClass}
          aria-label={label}
        >
          <Download className={iconOnly || !compact ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
          {showLabel && (
            <span className={responsive ? "hidden sm:inline truncate" : "truncate"}>{label}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {hasPdf && (
          <DropdownMenuItem onClick={onExportPdf}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </DropdownMenuItem>
        )}
        {hasExcel && (
          <DropdownMenuItem onClick={onExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </DropdownMenuItem>
        )}
        {hasPrint && (
          <DropdownMenuItem onClick={onPrintSlips}>
            <Printer className="mr-2 h-4 w-4" />
            Print slips
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
