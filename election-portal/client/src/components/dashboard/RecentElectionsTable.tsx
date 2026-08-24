import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ElectionWithDetails } from "@/lib/types";
import { getElectionLabel, isElectionEditable } from "@/lib/electionHelpers";
import { ElectionCard } from "@/components/elections/ElectionCard";
import { Pencil, BarChart2 } from "lucide-react";

interface RecentElectionsTableProps {
  elections: ElectionWithDetails[];
}

function getElectionId(election: ElectionWithDetails) {
  return (
    (election as any)._id?.toString() ||
    (election as any).id?.toString() ||
    ""
  );
}

export function RecentElectionsTable({ elections }: RecentElectionsTableProps) {
  const [, navigate] = useLocation();

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="app-section-title">Recent Elections</h3>
        <Link href="/elections">
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-medium text-primary hover:text-primary/80"
          >
            View all
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {elections.map((election) => {
          const id = getElectionId(election);
          const editable = isElectionEditable(election.status);

          return (
            <ElectionCard
              key={id}
              election={election}
              onClick={() => navigate(`/elections/${id}`)}
              actions={
                <div className="flex items-center gap-0.5">
                  {editable ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Edit"
                      aria-label="Edit election"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/elections/${id}/edit`);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="View results"
                      aria-label="View results"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/elections/${id}?tab=results`);
                      }}
                    >
                      <BarChart2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
