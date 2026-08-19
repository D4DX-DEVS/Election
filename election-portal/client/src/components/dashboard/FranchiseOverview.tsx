import { DashboardStats } from "@/lib/types";
import {
  CompactList,
  CompactListPrimary,
  CompactListRow,
  CompactListSecondary,
} from "@/components/ui/compact-list";

interface FranchiseOverviewProps {
  stats: Pick<DashboardStats, "totalFranchises" | "totalElections" | "franchiseDistribution">;
}

export function FranchiseOverview({ stats }: FranchiseOverviewProps) {
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
        <CompactList>
          {franchises.map((franchise) => (
            <CompactListRow key={franchise.id || franchise.name}>
              <CompactListPrimary>{franchise.name}</CompactListPrimary>
              <CompactListSecondary>
                {[
                  `${franchise.electionCount ?? 0} election(s)`,
                  hasDistribution ? `${franchise.percentage}%` : null,
                  franchise.contactNumber,
                ].filter(Boolean).join(" · ")}
              </CompactListSecondary>
            </CompactListRow>
          ))}
        </CompactList>
      ) : (
        <p className="app-muted">No franchises yet.</p>
      )}
    </div>
  );
}
