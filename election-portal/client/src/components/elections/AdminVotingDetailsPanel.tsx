import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ShieldAlert, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface VoteDetailNominee {
  _id?: string;
  id?: string;
  name?: string;
}

interface VoteDetailRow {
  _id?: string;
  voter?: {
    _id?: string;
    id?: string;
    fullName?: string | null;
    username?: string | null;
    registrationNumber?: string | null;
  } | null;
  nominees?: (VoteDetailNominee | string)[];
  timestamp?: string | Date | null;
}

interface AdminVotingDetailsPanelProps {
  electionId: string;
  enabled: boolean;
  /** Votes can only be cleared while voting is still open. */
  votingOpen?: boolean;
}

function nomineeLabel(n: VoteDetailNominee | string) {
  if (typeof n === "string") return n;
  return n.name || n._id || n.id || "Unknown";
}

export function AdminVotingDetailsPanel({
  electionId,
  enabled,
  votingOpen = false,
}: AdminVotingDetailsPanelProps) {
  const { toast } = useToast();
  const [pendingReset, setPendingReset] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/vote/details", electionId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vote/details/${electionId}`);
      return res.json();
    },
    enabled: enabled && !!electionId,
  });

  const resetMutation = useMutation({
    mutationFn: async (voterId: string) => {
      const res = await apiRequest("DELETE", `/api/vote/${electionId}/voter/${voterId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vote/details", electionId] });
      queryClient.invalidateQueries({ queryKey: [`/api/elections/${electionId}/voting-status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/elections/${electionId}/voting-roster`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vote/results", electionId] });
      setPendingReset(null);
      toast({
        title: "Vote cleared",
        description: "The voter can now cast their vote again.",
        variant: "success",
      });
    },
    onError: (err: Error) => {
      setPendingReset(null);
      toast({ title: "Could not clear vote", description: err.message, variant: "destructive" });
    },
  });

  if (!enabled) return null;

  const rows: VoteDetailRow[] = Array.isArray(data?.data) ? data.data : [];

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Admin Voting Details
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Confidential — shows each voter&apos;s ballot choices. Not shared with voters and excluded from print/export.
            </p>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 shrink-0">
            Admin only
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-gray-500">Loading voting details…</p>}
        {isError && (
          <p className="text-sm text-red-600">Could not load voting details. Ensure you have admin access.</p>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-sm text-gray-500">No votes recorded yet.</p>
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <>
          {/* Mobile: house-style cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((row) => {
              const voterName = row.voter?.fullName || row.voter?.username || "Unknown voter";
              const voterRef = row.voter?.registrationNumber || row.voter?.username || "—";
              const voterKey = String(row.voter?._id || row.voter?.id || "");
              const picks = (row.nominees || []).map(nomineeLabel).join(", ") || "—";
              const votedAt = row.timestamp
                ? new Date(row.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                : "—";
              return (
                <div
                  key={row._id}
                  className="rounded-lg border border-gray-200 bg-white p-5 space-y-3"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">
                      {voterName}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">{voterRef}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-center font-medium text-gray-700">
                      {picks}
                    </span>
                    <span className="inline-flex items-center text-gray-500">{votedAt}</span>
                  </div>
                  {votingOpen && (
                    <div className="flex items-center border-t border-gray-100 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!voterKey || resetMutation.isPending}
                        onClick={() => setPendingReset({ id: voterKey, name: voterName })}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset vote
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-md border border-amber-200 bg-white lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-2 font-medium">Voter</th>
                  <th className="px-4 py-2 font-medium">Username</th>
                  <th className="px-4 py-2 font-medium">Selected Nominee(s)</th>
                  <th className="px-4 py-2 font-medium">Voted At</th>
                  {votingOpen && <th className="px-4 py-2 font-medium text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const voterName = row.voter?.fullName || row.voter?.username || "Unknown voter";
                  const voterId = row.voter?.registrationNumber || row.voter?.username || "—";
                  const voterKey = String(row.voter?._id || row.voter?.id || "");
                  const picks = (row.nominees || []).map(nomineeLabel).join(", ") || "—";
                  const votedAt = row.timestamp
                    ? new Date(row.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                    : "—";
                  return (
                    <tr key={row._id} className="border-b last:border-0">
                      <td className="px-4 py-2">{voterName}</td>
                      <td className="px-4 py-2 text-gray-600">{voterId}</td>
                      <td className="px-4 py-2">{picks}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{votedAt}</td>
                      {votingOpen && (
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!voterKey || resetMutation.isPending}
                            onClick={() => setPendingReset({ id: voterKey, name: voterName })}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reset vote
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!pendingReset}
        onOpenChange={(open) => !open && setPendingReset(null)}
        onConfirm={() => pendingReset && resetMutation.mutate(pendingReset.id)}
        loading={resetMutation.isPending}
        title="Clear this vote?"
        description={
          pendingReset
            ? `This deletes ${pendingReset.name}'s ballot so they can vote again. Their previous choices cannot be recovered.`
            : ""
        }
        confirmText="Clear vote"
      />
    </Card>
  );
}
