import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { ResultsTable } from "@/components/analytics/ResultsTable";

interface ElectionResultsSummaryProps {
  electionId: string;
}

export function ElectionResultsSummary({ electionId }: ElectionResultsSummaryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/vote/results", electionId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vote/results/${electionId}`);
      return res.json();
    },
    enabled: !!electionId,
  });
  const results = data?.data;

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  if (!results) {
    return <p className="text-sm text-gray-500">Results not available.</p>;
  }

  const nominees = results.nominees || [];
  const numberToBeElected = results.election?.numberToBeElected || 1;

  // Competition ranking (1,1,3 not 1,2,3): equal vote counts share the same rank.
  // A rank group only counts as elected if it fits within the seats without
  // overflowing — a tie straddling the cutoff means nobody in it is a winner yet.
  const sortedNominees = [...nominees].sort((a: any, b: any) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  const ranks: number[] = [];
  sortedNominees.forEach((n: any, index: number) => {
    ranks.push(index > 0 && n.voteCount === sortedNominees[index - 1].voteCount ? ranks[index - 1] : index + 1);
  });
  const rankLastIndex: Record<number, number> = {};
  ranks.forEach((rank, index) => { rankLastIndex[rank] = index; });
  const winners = sortedNominees.filter((_: any, index: number) => rankLastIndex[ranks[index]] + 1 <= numberToBeElected);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{results.totalBallots ?? 0}</p>
            <p className="text-xs text-gray-500">Votes Cast</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{results.eligibleVoters ?? 0}</p>
            <p className="text-xs text-gray-500">Eligible Voters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{results.turnout ?? 0}%</p>
            <p className="text-xs text-gray-500">Turnout</p>
          </CardContent>
        </Card>
      </div>

      {winners.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Winner{winners.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {winners.map((w: any) => (
              <span
                key={w._id || w.id}
                className="inline-flex items-center gap-2 rounded-full bg-green-100 text-green-800 px-4 py-2 text-sm font-medium"
              >
                {w.name}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <ResultsTable
        nominees={nominees}
        numberToBeElected={results.election?.numberToBeElected || 1}
      />
    </div>
  );
}
