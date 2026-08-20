import { format } from "date-fns";
import { Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ElectionWithDetails } from "@/lib/types";
import { getElectionLabel } from "@/lib/electionHelpers";
import type { ReactNode } from "react";

// ─── Status badge ─────────────────────────────────────────────────────────────

type ElectionStatus = "active" | "completed" | "draft" | "archived";

function electionStatusVariant(
  status: string
): ElectionStatus | "outline" {
  if (
    status === "active" ||
    status === "completed" ||
    status === "draft" ||
    status === "archived"
  ) {
    return status;
  }
  return "outline";
}

function electionStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ─── Election logo ────────────────────────────────────────────────────────────

export function ElectionCardLogo({
  logo,
  label,
  className,
}: {
  logo?: { url?: string; alt?: string } | null;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50",
        className
      )}
    >
      {logo?.url ? (
        <img
          src={logo.url}
          alt={logo.alt || label}
          className="h-full w-full object-cover"
        />
      ) : (
        <Vote className="h-1/2 w-1/2 text-gray-300" />
      )}
    </div>
  );
}

// Re-export for consumers that import from this module
export { electionStatusVariant };
export function ElectionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={electionStatusVariant(status) as any}>
      {electionStatusLabel(status)}
    </Badge>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface ElectionCardProps {
  election: ElectionWithDetails;
  /** Called when the card body is clicked (navigates to detail page). */
  onClick?: () => void;
  /** Action icons rendered in the top-right corner (Edit, Delete, Status…). */
  actions?: ReactNode;
  /** Optional leading element (e.g. selection checkbox in bulk-delete mode). */
  selectionLeading?: ReactNode;
  className?: string;
}

export function ElectionCard({
  election,
  onClick,
  actions,
  selectionLeading,
  className,
}: ElectionCardProps) {
  const label = getElectionLabel(election);
  const logo = (election as any).logo as
    | { url?: string; alt?: string }
    | null
    | undefined;

  const dateLabel = election.electionDate
    ? format(new Date(election.electionDate), "MMM d, yyyy")
    : "—";

  const nomineeCount = election.nomineeCount ?? 0;
  const voterCount = election.voterCount ?? 0;

  const totalVotesCast = election.analytics?.totalVotesCast ?? 0;
  const totalVoters = election.analytics?.totalVoters ?? voterCount;
  const turnout =
    totalVoters > 0 ? Math.round((totalVotesCast / totalVoters) * 100) : 0;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Open ${label}` : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-150",
        onClick &&
          "cursor-pointer hover:border-primary/20 hover:shadow-md active:scale-[0.995]",
        className
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        {selectionLeading}

        {/* Logo */}
        <ElectionCardLogo
          logo={logo}
          label={label}
          className="mt-0.5 h-9 w-9 shrink-0"
        />

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold leading-snug text-gray-900">
              {label}
            </h3>
            <ElectionStatusBadge status={election.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">{dateLabel}</p>
        </div>

        {/* Trailing actions */}
        {actions && (
          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {/* ── Stat grid ──────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="grid grid-cols-3 gap-3">
          {/* Nominees */}
          <div className="flex flex-col gap-1">
            <span className="app-stat-label">Nominees</span>
            <span className="app-stat-value">{nomineeCount}</span>
          </div>

          {/* Voters */}
          <div className="flex flex-col gap-1">
            <span className="app-stat-label">Voters</span>
            <span className="app-stat-value">{voterCount}</span>
          </div>

          {/* Turnout */}
          <div className="flex flex-col gap-1">
            <span className="app-stat-label">Turnout</span>
            <span className="app-stat-value">{turnout}%</span>
          </div>
        </div>

        {/* Turnout progress bar */}
        <Progress
          value={turnout}
          className="mt-2.5 h-1 rounded-full bg-gray-100"
          aria-label={`Turnout: ${turnout}%`}
        />
      </div>
    </div>
  );
}
