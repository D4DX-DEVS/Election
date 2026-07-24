import { useState } from "react";
import { Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getElectionLabel, getElectionSubtitle, isElectionEditable } from "@/lib/electionHelpers";
import { Link } from "wouter";
import { ElectionWithDetails } from "@/lib/types";

interface RecentElectionsTableProps {
  elections: ElectionWithDetails[];
}

export function RecentElectionsTable({ elections }: RecentElectionsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base md:text-lg font-medium text-gray-900">Recent Elections</h3>
        <Link href="/elections">
          <Button variant="link" className="h-auto p-0 text-sm font-medium text-primary hover:text-primary-dark">
            View all
          </Button>
        </Link>
      </div>
      <div className="md:hidden space-y-3">
        {elections.map((election) => {
          const electionId = (election as any)._id?.toString() || (election as any).id?.toString();
          const totalVoters = election.analytics?.totalVoters || 0;
          const totalVotesCast = election.analytics?.totalVotesCast || 0;
          const participationPercentage = totalVoters > 0
            ? Math.round((totalVotesCast / totalVoters) * 100)
            : 0;
          const expanded = expandedIds.has(electionId);

          return (
            <div
              key={electionId}
              className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 cursor-pointer"
              onClick={() => toggleExpanded(electionId)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{getElectionLabel(election)}</h3>
                  {getElectionSubtitle(election) && (
                    <p className="text-xs text-gray-500 truncate">{getElectionSubtitle(election)}</p>
                  )}
                </div>
                <StatusBadge status={election.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center font-medium text-gray-700">
                  <Calendar className="h-4 w-4 mr-1" />
                  {format(new Date(election.electionDate), 'yyyy-MM-dd')}
                </span>
                <span className="inline-flex items-center font-medium text-gray-700">
                  <Users className="h-4 w-4 mr-1" />
                  {participationPercentage}% ({totalVotesCast}/{totalVoters})
                </span>
              </div>
              <Progress value={participationPercentage} className="h-2.5" />
              {expanded && (
                <div
                  className="flex items-center gap-1 border-t border-gray-100 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/elections/${electionId}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                  {isElectionEditable(election.status) ? (
                    <Link href={`/elections/${electionId}/edit`}>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </Link>
                  ) : (
                    <Link href={`/elections/${electionId}?tab=results`}>
                      <Button variant="ghost" size="sm">Results</Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-white">Election</TableHead>
                <TableHead className="bg-white">Date</TableHead>
                <TableHead className="bg-white">Status</TableHead>
                <TableHead className="bg-white">Participation</TableHead>
                <TableHead className="bg-white text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {elections.map((election) => {
                const electionId = (election as any)._id?.toString() || (election as any).id?.toString();
                const totalVoters = election.analytics?.totalVoters || 0;
                const totalVotesCast = election.analytics?.totalVotesCast || 0;
                const participationPercentage = totalVoters > 0 
                  ? Math.round((totalVotesCast / totalVoters) * 100) 
                  : 0;

                return (
                  <TableRow key={electionId} className="transition-colors hover:bg-primary/5">
                    <TableCell className="font-medium">
                      {getElectionLabel(election)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(election.electionDate), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={election.status} />
                    </TableCell>
                    <TableCell>
                      <div className="w-full">
                        <Progress value={participationPercentage} className="h-2.5 mb-1" />
                        <div className="text-xs text-gray-600">
                          {participationPercentage}% ({totalVotesCast}/{totalVoters})
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/elections/${electionId}`}>
                        <Button variant="link" className="text-primary hover:text-primary-dark mr-3">
                          View
                        </Button>
                      </Link>
                      {isElectionEditable(election.status) ? (
                        <Link href={`/elections/${electionId}/edit`}>
                          <Button variant="link" className="text-gray-600 hover:text-gray-900">
                            Edit
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/elections/${electionId}?tab=results`}>
                          <Button variant="link" className="text-gray-600 hover:text-gray-900">
                            Results
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
          Active
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Completed
        </Badge>
      );
    case 'draft':
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-primary/10">
          Draft
        </Badge>
      );
    case 'archived':
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Archived
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-primary/10">
          {status}
        </Badge>
      );
  }
}
