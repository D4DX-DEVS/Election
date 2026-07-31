import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/StatCard";
import { CheckCircle2, Clock, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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

export function VotingStatusPanel({ electionId }: { electionId: string }) {
  const { data, isLoading, isError } = useQuery<{ data?: VotingStatusResponse }>({
    queryKey: [`/api/elections/${electionId}/voting-status`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/elections/${electionId}/voting-status`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <Skeleton className="h-24 w-full md:h-28" />
        <Skeleton className="h-24 w-full md:h-28" />
        <Skeleton className="h-24 w-full md:h-28" />
      </div>
    );
  }

  const status = data?.data;
  if (isError || !status) {
    return null;
  }

  const { current, posts } = status;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
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
        />
      </div>

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
