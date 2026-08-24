import { format } from "date-fns";
import { ChevronRight, Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getElectionLabel } from "@/lib/electionHelpers";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export type VoterElectionItem = {
  _id?: string;
  id?: string;
  organization?: string;
  title?: string;
  electionDate?: string;
  numberToBeElected?: number;
  logo?: { url?: string; alt?: string };
  status?: string;
  allowRevote?: boolean;
  voteStats?: { voted?: number; eligible?: number };
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

type VoterStatusKey = "active" | "completed" | "draft";

function getStatusVariant(status?: string): VoterStatusKey | "outline" {
  if (status === "active") return "active";
  if (status === "completed") return "completed";
  return "draft";
}

function getStatusLabel(status?: string) {
  if (status === "active") return "Active";
  if (status === "completed") return "Completed";
  return "Not started";
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
    <Card className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <CardHeader className="border-b border-gray-100 px-4 py-3">
        <CardTitle className="text-sm font-semibold text-gray-900">
          Your Elections
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-3">
        {elections.map((election) => {
          const id = getElectionId(election);
          const voted = votingStatus[id] === "voted";
          const isActive = election.status === "active";
          const notStarted = !isActive && election.status !== "completed";
          const clickable =
            isActive || (voted && election.status === "completed");
          const canRevote = voted && isActive && !!election.allowRevote;
          const label = getElectionLabel(election);
          const positions = election.numberToBeElected ?? 1;
          const dateLabel = formatElectionDate(election.electionDate);
          const voteStats = election.voteStats;
          const eligible = voteStats?.eligible ?? 0;
          const votedCount = voteStats?.voted ?? 0;
          const turnoutPct =
            eligible > 0 ? Math.round((votedCount / eligible) * 100) : 0;
          const showTurnout = voted && eligible > 0;

          const handleClick = () => {
            if (clickable) {
              onElectionClick(id);
              return;
            }
            if (notStarted) {
              toast({
                title: "Election not started",
                description:
                  "This election is not open for voting yet. You'll be able to vote once it starts.",
              });
            }
          };

          // Badge: "Voted" overrides the status badge when voter has cast a vote
          const badgeVariant = voted
            ? ("completed" as const)
            : (getStatusVariant(election.status) as any);
          const badgeLabel = voted ? "Voted" : getStatusLabel(election.status);

          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              aria-label={
                clickable
                  ? canRevote
                    ? `Revote in ${label}`
                    : voted
                      ? `View vote for ${label}`
                      : `Vote in ${label}`
                  : label
              }
              onClick={handleClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick();
                }
              }}
              className={cn(
                "group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-150",
                clickable
                  ? "cursor-pointer hover:border-primary/20 hover:shadow-md active:scale-[0.995]"
                  : "cursor-default opacity-70",
                voted && "border-blue-100 bg-blue-50/20"
              )}
            >
              {/* Header */}
              <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
                {/* Logo */}
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                  {election.logo?.url ? (
                    <img
                      src={election.logo.url}
                      alt={election.logo.alt || label}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Vote className="h-4 w-4 text-gray-300" />
                  )}
                </div>

                {/* Title + date */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-sm font-semibold leading-snug text-gray-900">
                      {label}
                    </h3>
                    <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {dateLabel}
                    {positions > 0 && (
                      <span className="ml-2 text-gray-300">·</span>
                    )}{" "}
                    <span className="ml-1">
                      Select {positions} position{positions !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>

                {/* CTA arrow */}
                {clickable && (
                  <div className="flex shrink-0 items-center text-primary">
                    <span className="hidden text-xs font-semibold sm:inline">
                      {canRevote ? "Revote" : voted ? "View vote" : "Vote"}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Turnout stat — only shown when voter has voted */}
              {showTurnout && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="app-stat-label">Turnout</span>
                    <span className="app-stat-value text-blue-700">
                      {votedCount}/{eligible} ({turnoutPct}%)
                    </span>
                  </div>
                  <Progress
                    value={turnoutPct}
                    className="mt-2 h-1 rounded-full bg-gray-100"
                    aria-label={`Turnout: ${turnoutPct}%`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
