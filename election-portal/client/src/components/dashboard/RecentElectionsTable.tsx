import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getElectionLabel, isElectionEditable } from "@/lib/electionHelpers";
import { Link, useLocation } from "wouter";
import { ElectionWithDetails } from "@/lib/types";
import {
  CompactList,
  CompactListActions,
  CompactListPrimary,
  CompactListRow,
  CompactListSecondary,
} from "@/components/ui/compact-list";

interface RecentElectionsTableProps {
  elections: ElectionWithDetails[];
}

export function RecentElectionsTable({ elections }: RecentElectionsTableProps) {
  const [, navigate] = useLocation();

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="app-section-title">Recent Elections</h3>
        <Link href="/elections">
          <Button variant="link" className="h-auto p-0 text-sm font-medium text-primary hover:text-primary-dark">
            View all
          </Button>
        </Link>
      </div>
      <CompactList>
        {elections.map((election) => {
          const electionId = (election as any)._id?.toString() || (election as any).id?.toString();
          const totalVoters = election.analytics?.totalVoters || 0;
          const totalVotesCast = election.analytics?.totalVotesCast || 0;
          const participationPercentage = totalVoters > 0
            ? Math.round((totalVotesCast / totalVoters) * 100)
            : 0;
          const dateLabel = election.electionDate
            ? format(new Date(election.electionDate), "yyyy-MM-dd")
            : "—";

          return (
            <CompactListRow key={electionId} onClick={() => navigate(`/elections/${electionId}`)} label={`Open ${getElectionLabel(election)}`}>
              <CompactListPrimary>{getElectionLabel(election)}</CompactListPrimary>
              <CompactListSecondary>
                {`${dateLabel} · ${participationPercentage}% (${totalVotesCast}/${totalVoters})`}
              </CompactListSecondary>
              <StatusBadge status={election.status} />
              <CompactListActions>
                {isElectionEditable(election.status) ? (
                  <Link href={`/elections/${electionId}/edit`}>
                    <Button variant="ghost" size="sm" className="h-8 px-2">Edit</Button>
                  </Link>
                ) : (
                  <Link href={`/elections/${electionId}?tab=results`}>
                    <Button variant="ghost" size="sm" className="h-8 px-2">Results</Button>
                  </Link>
                )}
              </CompactListActions>
            </CompactListRow>
          );
        })}
      </CompactList>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge variant="outline" className="shrink-0 bg-green-100 text-green-800 hover:bg-green-100">
          Active
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="shrink-0 bg-blue-100 text-blue-800 hover:bg-blue-100">
          Completed
        </Badge>
      );
    case "draft":
      return (
        <Badge variant="outline" className="shrink-0 bg-gray-100 text-gray-800 hover:bg-primary/10">
          Draft
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline" className="shrink-0 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Archived
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="shrink-0 bg-gray-100 text-gray-800 hover:bg-primary/10">
          {status}
        </Badge>
      );
  }
}
