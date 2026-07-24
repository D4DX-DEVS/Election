import { Progress } from "@/components/ui/progress";
import { DashboardStats } from "@/lib/types";
import { Globe, Phone } from "lucide-react";

interface FranchiseOverviewProps {
  stats: Pick<DashboardStats, "totalFranchises" | "totalElections" | "franchiseDistribution">;
}

function formatWebsiteHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function FranchiseOverview({ stats }: FranchiseOverviewProps) {
  const franchises = stats.franchiseDistribution;
  const hasDistribution = franchises.some((f) => (f.electionCount ?? 0) > 0 || f.percentage > 0);

  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-lg font-medium text-gray-900">Franchises</h3>

      {!hasDistribution && franchises.length > 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 md:px-4 md:py-3 text-xs md:text-sm text-gray-600">
          Election distribution will appear once elections are assigned to franchises.
        </div>
      )}

      {franchises.length > 0 ? (
        franchises.map((franchise) => (
          <div
            key={franchise.id || franchise.name}
            className="rounded-lg border border-gray-200 bg-white p-5 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm md:text-base font-medium text-gray-900">{franchise.name}</p>
                <p className="text-xs text-gray-500">
                  {franchise.electionCount ?? 0} election(s)
                  {hasDistribution ? ` · ${franchise.percentage}% of total` : ""}
                </p>
              </div>
            </div>

            {hasDistribution && (
              <Progress value={franchise.percentage} className="h-2" />
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {franchise.websiteUrl && (
                <a
                  href={formatWebsiteHref(franchise.websiteUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center font-medium text-blue-600 hover:underline"
                >
                  <Globe className="h-4 w-4 mr-1 shrink-0" />
                  Website
                </a>
              )}
              {franchise.contactNumber && (
                <span className="inline-flex items-center font-medium text-gray-700">
                  <Phone className="h-4 w-4 mr-1 shrink-0" />
                  {franchise.contactNumber}
                </span>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500">No franchises yet.</p>
      )}
    </div>
  );
}
