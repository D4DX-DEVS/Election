import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/StatCard";
import { CheckCircle2, Clock, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { CompactList, CompactListPrimary, CompactListRow, CompactListSecondary } from "@/components/ui/compact-list";

interface VotingStatusEntry {
  electionId: string;
  title?: string;
  organization?: string;
  totalVoters: number;
  votedCount: number;
  remainingCount: number;
  turnoutPercent: number;
}

interface VotingStatusResponse {
  current: VotingStatusEntry;
  posts: VotingStatusEntry[];
}

interface RosterVoter {
  id: string;
  username: string;
  fullName?: string;
  voteCount?: number;
  votedAt?: string | null;
}

interface RosterResponse {
  voted: RosterVoter[];
  notVoted: RosterVoter[];
  totals: { assigned: number; voted: number; notVoted: number };
}

/** Voter roster column — voted (with pick counts) or still pending. */
function RosterList({
  title,
  icon,
  accent,
  voters,
  showCounts,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  voters: RosterVoter[];
  showCounts?: boolean;
  emptyText: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <span className={accent}>{icon}</span>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="ml-auto text-xs font-medium text-gray-500">{voters.length}</span>
        </div>
        {voters.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">{emptyText}</p>
        ) : (
          <CompactList className="rounded-none border-0 max-h-80 overflow-y-auto">
            {voters.map((voter) => (
              <CompactListRow key={voter.id}>
                <CompactListPrimary>
                  {voter.fullName?.trim() || voter.username}
                </CompactListPrimary>
                {voter.fullName?.trim() && voter.fullName.trim() !== voter.username && (
                  <CompactListSecondary>{voter.username}</CompactListSecondary>
                )}
                {showCounts && (
                  <span className="shrink-0 text-xs font-medium text-gray-600 tabular-nums">
                    {voter.voteCount ?? 0} vote{(voter.voteCount ?? 0) === 1 ? "" : "s"}
                  </span>
                )}
              </CompactListRow>
            ))}
          </CompactList>
        )}
      </CardContent>
    </Card>
  );
}

export function VotingStatusPanel({ electionId }: { electionId: string }) {
  const { data, isLoading, isError } = useQuery<{ data?: VotingStatusResponse }>({
    queryKey: [`/api/elections/${electionId}/voting-status`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/elections/${electionId}/voting-status`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: rosterData } = useQuery<{ data?: RosterResponse }>({
    queryKey: [`/api/elections/${electionId}/voting-roster`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/elections/${electionId}/voting-roster`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Skeleton className="h-24 w-full md:h-28" />
        <Skeleton className="h-24 w-full md:h-28" />
        <Skeleton className="col-span-2 h-24 w-full sm:col-span-1 md:h-28" />
      </div>
    );
  }

  const status = data?.data;
  if (isError || !status) {
    return null;
  }

  const { current, posts } = status;
  const roster = rosterData?.data;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 mb-4">
        <StatCard
          title="Votes cast"
          value={current.votedCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          title="Remaining voters"
          value={current.remainingCount}
          icon={<Clock className="h-5 w-5" />}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Total voters"
          value={current.totalVoters}
          icon={<Users className="h-5 w-5" />}
          iconBgColor="bg-indigo-100"
          iconColor="text-indigo-600"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {roster && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <RosterList
            title="Voted"
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="text-green-600"
            voters={roster.voted}
            showCounts
            emptyText="No one has voted yet."
          />
          <RosterList
            title="Not voted"
            icon={<Clock className="h-4 w-4" />}
            accent="text-amber-600"
            voters={roster.notVoted}
            emptyText="Everyone has voted."
          />
        </div>
      )}

      {posts.length > 1 && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Vote count by post</h3>
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.electionId} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="truncate text-sm font-medium text-gray-700">
                      {post.title || post.organization || "Untitled post"}
                    </p>
                    <p className="shrink-0 text-xs text-gray-500">
                      {post.votedCount}/{post.totalVoters} voted
                    </p>
                  </div>
                  <Progress value={post.turnoutPercent} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
