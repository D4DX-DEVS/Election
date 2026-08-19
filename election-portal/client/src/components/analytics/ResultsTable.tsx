import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Printer, Download, Award } from "lucide-react";
import { NomineeWithVotes } from "@/lib/types";
import {
  CompactList,
  CompactListPrimary,
  CompactListRow,
  CompactListSecondary,
} from "@/components/ui/compact-list";
import { cn } from "@/lib/utils";

interface ResultsTableProps {
  nominees: NomineeWithVotes[];
  numberToBeElected: number;
  onPrint?: () => void;
  onExport?: () => void;
}

export function ResultsTable({
  nominees,
  numberToBeElected,
  onPrint,
  onExport
}: ResultsTableProps) {
  // Sort nominees by vote count (descending)
  const sortedNominees = [...nominees].sort((a, b) => {
    if (a.voteCount === undefined || b.voteCount === undefined) return 0;
    return b.voteCount - a.voteCount;
  });

  // Competition ranking (1,1,3 not 1,2,3): equal vote counts share the same rank.
  const ranks: number[] = [];
  sortedNominees.forEach((nominee, index) => {
    if (index > 0 && nominee.voteCount === sortedNominees[index - 1].voteCount) {
      ranks.push(ranks[index - 1]);
    } else {
      ranks.push(index + 1);
    }
  });
  const rankCounts = ranks.reduce<Record<number, number>>((acc, rank) => {
    acc[rank] = (acc[rank] || 0) + 1;
    return acc;
  }, {});
  // Last sorted-index occupied by each rank — i.e. how many nominees rank at or above it.
  const rankLastIndex = ranks.reduce<Record<number, number>>((acc, rank, index) => {
    acc[rank] = index;
    return acc;
  }, {});
  // A rank group is only cleanly elected if including everyone in it doesn't exceed
  // the number of seats. If a tie straddles the cutoff, nobody in that group is
  // declared elected until the tie is resolved.
  const isRankElected = (rank: number) => rankLastIndex[rank] + 1 <= numberToBeElected;

  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle>Election Results</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <CompactList className="rounded-none border-0">
          {sortedNominees.map((nominee, index) => {
            const rank = ranks[index];
            const tied = rankCounts[rank] > 1;
            const isElected = isRankElected(rank);
            const nomineeId = (nominee as NomineeWithVotes & { _id?: string })._id || nominee.id;
            return (
              <CompactListRow
                key={nomineeId}
                className={cn(isElected && "bg-green-50 hover:bg-green-50/80")}
              >
                <span className="w-8 shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                  #{rank}
                </span>
                <CompactListPrimary>{nominee.name}</CompactListPrimary>
                <CompactListSecondary>
                  {`${nominee.voteCount ?? 0} votes · ${(nominee.percentage || 0).toFixed(1)}%`}
                  {tied ? " · Tied" : ""}
                </CompactListSecondary>
                {isElected && <Award className="h-4 w-4 shrink-0 text-yellow-500" />}
              </CompactListRow>
            );
          })}
        </CompactList>
      </CardContent>
      <CardFooter className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
        <div>
          <Badge>
            <Award className="mr-1 h-4 w-4" />
            Elected
          </Badge>
        </div>
        <div className="flex space-x-2">
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      {children}
    </span>
  );
}
