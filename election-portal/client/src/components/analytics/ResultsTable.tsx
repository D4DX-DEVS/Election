import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Printer, Download, Award, Percent } from "lucide-react";
import { NomineeWithVotes } from "@/lib/types";

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
        <CardTitle className="text-lg font-medium text-gray-900">Election Results</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4 lg:hidden">
          {sortedNominees.map((nominee, index) => {
            const rank = ranks[index];
            const tied = rankCounts[rank] > 1;
            const isElected = isRankElected(rank);
            const nomineeId = (nominee as NomineeWithVotes & { _id?: string })._id || nominee.id;
            return (
              <div
                key={nomineeId}
                className={`rounded-lg border p-5 space-y-4 ${isElected ? "border-green-200 bg-green-50/60" : "border-gray-200 bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">{nominee.name}</h3>
                    <p className="text-xs text-gray-500">
                      Rank #{rank}
                      {tied && <span className="ml-1 text-gray-400">(Tied)</span>}
                    </p>
                  </div>
                  {isElected && <Award className="h-5 w-5 text-yellow-500 shrink-0" />}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center font-medium text-gray-700">
                    {nominee.voteCount || 0} votes
                  </span>
                  <span className="inline-flex items-center font-medium text-gray-700">
                    <Percent className="h-4 w-4 mr-1" />
                    {(nominee.percentage || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-white">Rank</TableHead>
                <TableHead className="bg-white">Nominee</TableHead>
                <TableHead className="bg-white text-right">Votes</TableHead>
                <TableHead className="bg-white text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedNominees.map((nominee, index) => {
                const rank = ranks[index];
                const tied = rankCounts[rank] > 1;
                const isElected = isRankElected(rank);
                return (
                <TableRow
                  key={nominee.id}
                  className={`transition-colors hover:bg-primary/5 ${isElected ? 'bg-green-50' : ''}`}
                >
                  <TableCell className="text-sm text-gray-500">
                    {rank}
                    {tied && (
                      <span className="ml-1 text-xs text-gray-400">(Tied)</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {nominee.name}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {nominee.voteCount !== undefined ? nominee.voteCount : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {nominee.percentage !== undefined ? `${nominee.percentage.toFixed(1)}%` : '-'}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
