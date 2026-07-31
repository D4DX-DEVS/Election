import { format } from "date-fns";
import { Calendar, ChevronRight, Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getElectionLabel } from "@/lib/electionHelpers";
import { cn } from "@/lib/utils";

export type VoterElectionItem = {
  _id?: string;
  id?: string;
  organization?: string;
  title?: string;
  electionDate?: string;
  numberToBeElected?: number;
  logo?: { url?: string; alt?: string };
  status?: string;
};

function getElectionId(election: VoterElectionItem) {
  return election._id?.toString() || election.id?.toString() || "";
}

function formatElectionDate(dateString?: string) {
  if (!dateString) return "—";
  try {
    return format(new Date(dateString), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "draft":
    default:
      return "Not started";
  }
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 hover:bg-green-100 border-green-200";
    case "completed":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200";
    default:
      return "bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200";
  }
}

interface VoterElectionListProps {
  elections: VoterElectionItem[];
  votingStatus: Record<string, string>;
  onElectionClick: (electionId: string) => void;
}

export function VoterElectionList({
  elections,
  votingStatus,
  onElectionClick,
}: VoterElectionListProps) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="px-4 py-3 border-b border-gray-200 md:px-6">
        <CardTitle className="text-base font-medium text-gray-900">Your elections</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-200">
          {elections.map((election) => {
            const id = getElectionId(election);
            const voted = votingStatus[id] === "voted";
            const isActive = election.status === "active";
            // Voters may still open a completed election if they already voted,
            // to review their past vote/result — otherwise only active is clickable.
            const clickable = isActive || (voted && election.status === "completed");
            const label = getElectionLabel(election);
            const positions = election.numberToBeElected ?? 1;
            const meta = `${formatElectionDate(election.electionDate)} · Select ${positions} position${positions !== 1 ? "s" : ""}`;

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => clickable && onElectionClick(id)}
                  disabled={!clickable}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 text-left transition-colors",
                    clickable ? "hover:bg-primary/5 active:bg-primary/10 cursor-pointer" : "cursor-default opacity-70",
                    voted ? "bg-blue-50/40" : ""
                  )}
                >
                  <div className="flex-shrink-0 w-11 h-11 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                    {election.logo?.url ? (
                      <img
                        src={election.logo.url}
                        alt={election.logo.alt || label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Vote className="h-5 w-5 text-primary/70" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 leading-tight truncate">{label}</h3>
                      {voted ? (
                        <Badge
                          variant="outline"
                          className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 text-[10px] px-1.5 py-0"
                        >
                          Voted
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", statusBadgeClass(election.status))}
                        >
                          {statusLabel(election.status)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      {meta}
                    </p>
                  </div>

                  {clickable && (
                    <div className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-primary">
                      <span className="hidden sm:inline">{voted ? "View vote" : "Vote"}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
