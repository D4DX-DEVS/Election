import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectCheckbox } from "@/components/ui/row-select-checkbox";
import { ShieldAlert, RotateCcw, Pencil } from "lucide-react";
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

interface BallotNominee {
  _id: string;
  name: string;
  gender?: string;
}

interface AdminVotingDetailsPanelProps {
  electionId: string;
  enabled: boolean;
  /** Votes can only be cleared/edited while voting is still open. */
  votingOpen?: boolean;
  numberToBeElected?: number;
  ballotSelectionRule?: "exact" | "up_to";
  genderBasedSelection?: boolean;
  maleMinimum?: number;
  femaleMinimum?: number;
}

function nomineeLabel(n: VoteDetailNominee | string) {
  if (typeof n === "string") return n;
  return n.name || n._id || n.id || "Unknown";
}

function nomineeId(n: VoteDetailNominee | string) {
  return String(typeof n === "string" ? n : n._id || n.id || "");
}

export function AdminVotingDetailsPanel({
  electionId,
  enabled,
  votingOpen = false,
  numberToBeElected = 1,
  ballotSelectionRule = "exact",
  genderBasedSelection = false,
  maleMinimum = 0,
  femaleMinimum = 0,
}: AdminVotingDetailsPanelProps) {
  const { toast } = useToast();
  const [pendingReset, setPendingReset] = useState<{ id: string; name: string } | null>(null);
  const [editingVoter, setEditingVoter] = useState<{ id: string; name: string } | null>(null);
  const [editSelection, setEditSelection] = useState<string[]>([]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/vote/details", electionId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vote/details/${electionId}`);
      return res.json();
    },
    enabled: enabled && !!electionId,
  });

  const { data: nomineesData } = useQuery({
    queryKey: [`/api/nominees/election/${electionId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/nominees/election/${electionId}`);
      return res.json();
    },
    enabled: enabled && !!electionId && !!editingVoter,
  });

  const ballotNominees: BallotNominee[] = useMemo(() => {
    const list = Array.isArray(nomineesData?.data) ? nomineesData.data : [];
    return list.map((n: any) => ({ _id: String(n._id || n.id), name: n.name, gender: n.gender }));
  }, [nomineesData]);

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

  const editMutation = useMutation({
    mutationFn: async ({ voterId, nomineeIds }: { voterId: string; nomineeIds: string[] }) => {
      const res = await apiRequest("PUT", `/api/vote/${electionId}/voter/${voterId}`, { nomineeIds });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not update vote");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vote/details", electionId] });
      queryClient.invalidateQueries({ queryKey: [`/api/elections/${electionId}/voting-status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/elections/${electionId}/voting-roster`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vote/results", electionId] });
      setEditingVoter(null);
      toast({
        title: "Vote updated",
        description: "The voter's ballot has been updated.",
        variant: "success",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update vote", description: err.message, variant: "destructive" });
    },
  });

  const seats = Math.max(numberToBeElected, 1);

  const toggleEditNominee = (id: string, checked: boolean) => {
    setEditSelection((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        if (prev.length >= seats) {
          toast({ title: "Maximum reached", description: `Select at most ${seats} nominee(s).`, variant: "destructive" });
          return prev;
        }
        return [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  };

  const openEditDialog = (voterId: string, name: string, currentNominees: (VoteDetailNominee | string)[]) => {
    setEditingVoter({ id: voterId, name });
    setEditSelection((currentNominees || []).map(nomineeId));
  };

  const handleSaveEdit = () => {
    if (!editingVoter) return;
    if (ballotSelectionRule === "exact" && editSelection.length !== seats) {
      toast({ title: "Selection required", description: `Select exactly ${seats} nominee(s).`, variant: "destructive" });
      return;
    }
    if (editSelection.length === 0) {
      toast({ title: "Selection required", description: "Select at least 1 nominee.", variant: "destructive" });
      return;
    }
    editMutation.mutate({ voterId: editingVoter.id, nomineeIds: editSelection });
  };

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
                    <div className="flex items-center gap-1 border-t border-gray-100 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!voterKey || editMutation.isPending}
                        onClick={() => openEditDialog(voterKey, voterName, row.nominees || [])}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit vote
                      </Button>
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
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!voterKey || editMutation.isPending}
                            onClick={() => openEditDialog(voterKey, voterName, row.nominees || [])}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!voterKey || resetMutation.isPending}
                            onClick={() => setPendingReset({ id: voterKey, name: voterName })}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reset
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

      <Dialog open={!!editingVoter} onOpenChange={(open) => !open && setEditingVoter(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingVoter?.name}&apos;s vote</DialogTitle>
            <DialogDescription>
              Choose {ballotSelectionRule === "up_to" ? `up to ${seats}` : `exactly ${seats}`} nominee
              {seats !== 1 ? "s" : ""}. Saving replaces their existing ballot.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-gray-200">
            {ballotNominees.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Loading nominees…</p>
            ) : (
              ballotNominees.map((n) => {
                const checked = editSelection.includes(n._id);
                return (
                  <div
                    key={n._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleEditNominee(n._id, !checked)}
                    className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-primary/5 cursor-pointer"
                  >
                    <SelectCheckbox
                      checked={checked}
                      onCheckedChange={(value) => toggleEditNominee(n._id, value)}
                      aria-label={`Select ${n.name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{n.name}</span>
                    {genderBasedSelection && n.gender && (
                      <Badge variant="outline" className="shrink-0 capitalize text-[10px] px-1.5 py-0 h-4">
                        {n.gender}
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {genderBasedSelection && (maleMinimum > 0 || femaleMinimum > 0) && (
            <p className="text-xs text-gray-500">
              Minimums: {maleMinimum > 0 ? `${maleMinimum} male` : ""}
              {maleMinimum > 0 && femaleMinimum > 0 ? " · " : ""}
              {femaleMinimum > 0 ? `${femaleMinimum} female` : ""}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVoter(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving…" : "Save vote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
