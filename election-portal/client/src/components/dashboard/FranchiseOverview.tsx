import { DashboardStats } from "@/lib/types";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FranchiseOverviewProps {
  stats: Pick<DashboardStats, "totalFranchises" | "totalElections" | "franchiseDistribution">;
}

export function FranchiseOverview({ stats }: FranchiseOverviewProps) {
  const [, navigate] = useLocation();
  const franchises = stats.franchiseDistribution;
  const hasDistribution = franchises.some((f) => (f.electionCount ?? 0) > 0 || f.percentage > 0);

  return (
    <div className="space-y-3">
      <h3 className="app-section-title">Franchises</h3>

      {!hasDistribution && franchises.length > 0 && (
        <p className="app-helper">
          Election distribution will appear once elections are assigned to franchises.
        </p>
      )}

      {franchises.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {franchises.map((franchise) => {
            const clickable = !!franchise.id;
            const electionLabel =
              `${franchise.electionCount ?? 0} election${(franchise.electionCount ?? 0) !== 1 ? "s" : ""}` +
              (hasDistribution && (franchise.percentage ?? 0) > 0 ? ` · ${franchise.percentage}%` : "");

            return (
              <div
                key={franchise.id || franchise.name}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={clickable ? `Open ${franchise.name}` : undefined}
                onClick={clickable ? () => navigate(`/franchises/${franchise.id}`) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/franchises/${franchise.id}`);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm transition-all duration-150",
                  clickable &&
                    "cursor-pointer hover:border-primary/20 hover:shadow-md active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                )}
              >
                <div className="min-w-0 flex-1">
                  {/* Name — breaks naturally; never truncated */}
                  <p className="break-words text-sm font-semibold leading-snug text-gray-900">
                    {franchise.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{electionLabel}</p>
                </div>
                {clickable && (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="app-muted">No franchises yet.</p>
      )}
    </div>
  );
}
