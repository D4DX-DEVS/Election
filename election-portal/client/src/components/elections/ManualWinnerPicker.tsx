import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectCheckbox } from "@/components/ui/row-select-checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { CompactList, CompactListLeading, CompactListPrimary, CompactListRow } from "@/components/ui/compact-list";

interface ResultNominee {
  _id?: string;
  id?: string;
  name: string;
  voteCount?: number;
  isElected?: boolean;
}

interface ManualWinnerPickerProps {
  electionId: string;
  enabled: boolean;
  numberToBeElected: number;
  nominees: ResultNominee[];
  manualWinnerIds?: string[];
  /** Result generation is locked once the election is completed/archived. */
  electionStatus?: string | null;
}

export function ManualWinnerPicker({
  electionId,
  enabled,
  numberToBeElected,
  nominees,
  manualWinnerIds = [],
  electionStatus,
}: ManualWinnerPickerProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<string[]>(manualWinnerIds.map(String));
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSelected(manualWinnerIds.map(String));
  }, [manualWinnerIds.join(",")]);

  const saveMutation = useMutation({
    mutationFn: async (nomineeIds: string[]) => {
      const res = await apiRequest("PATCH", `/api/elections/${electionId}/manual-winners`, { nomineeIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/elections/${electionId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vote/results", electionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      toast({
        title: "Winners saved",
        description: "Manual winner selection has been updated.",
        variant: "success",
      });
      navigate("/elections");
    },
    onError: (err: Error) => {
      toast({
        title: "Could not save winners",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!enabled) return null;

  const seats = Math.max(numberToBeElected, 1);
  const isLocked = electionStatus === "completed" || electionStatus === "archived";

  // Highest votes first, so the cut-off for the last winning seat is visible.
  const ranked = [...nominees].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));

  // A tie only needs breaking when the tied group *straddles* the last winning
  // seat — i.e. those clearly ahead plus the tied group overflow the seats. Two
  // nominees tied for two seats both win, so that is not an ambiguity.
  const cutoffVotes = ranked.length > seats ? ranked[seats - 1]?.voteCount ?? null : null;
  const tiedCount =
    cutoffVotes === null
      ? 0
      : ranked.filter((n) => (n.voteCount ?? 0) === cutoffVotes).length;
  const clearlyAhead =
    cutoffVotes === null
      ? 0
      : ranked.filter((n) => (n.voteCount ?? 0) > cutoffVotes).length;
  const hasCutoffTie =
    cutoffVotes !== null &&
    cutoffVotes > 0 && // before any votes are cast there is nothing to compare
    tiedCount > 1 &&
    clearlyAhead + tiedCount > seats;
  const isTiedAtCutoff = (n: ResultNominee) =>
    hasCutoffTie && (n.voteCount ?? 0) === cutoffVotes;

  const toggleNominee = (id: string, checked: boolean) => {
    setSelected((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        if (prev.length >= seats) {
          toast({
            title: "Maximum reached",
            description: `You can select at most ${seats} winner(s).`,
            variant: "destructive",
          });
          return prev;
        }
        return [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  };

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
        <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-blue-600" />
              Manual Winner Selection
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Pick up to {seats} winner{seats !== 1 ? "s" : ""} after voting. Results use your selection instead of vote tallies.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {selected.length}/{seats} selected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasCutoffTie && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-800">
              {tiedCount} nominees are tied on {cutoffVotes} vote{cutoffVotes === 1 ? "" : "s"} for
              the last winning position. Pick which of them takes the seat.
            </p>
          </div>
        )}

        {nominees.length === 0 ? (
          <p className="text-sm text-gray-500">Add nominees before selecting winners.</p>
        ) : (
          <CompactList>
            {ranked.map((nominee, index) => {
              const id = String(nominee._id || nominee.id);
              const checked = selected.includes(id);
              const tied = isTiedAtCutoff(nominee);
              return (
                <CompactListRow
                  key={id}
                  onClick={isLocked ? undefined : () => toggleNominee(id, !checked)}
                  className={cn(
                    tied && "bg-amber-50 hover:bg-amber-100/70",
                    isLocked && "cursor-not-allowed opacity-60"
                  )}
                >
                  <CompactListLeading>
                  <SelectCheckbox
                    checked={checked}
                    onCheckedChange={(value) => !isLocked && toggleNominee(id, value)}
                    aria-label={`Select ${nominee.name} as winner`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  </CompactListLeading>
                  <span className="w-6 shrink-0 text-xs font-medium text-gray-400 tabular-nums">
                    {index + 1}
                  </span>
                  <CompactListPrimary>{nominee.name}</CompactListPrimary>
                  {tied && (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-amber-300 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0"
                    >
                      Tied
                    </Badge>
                  )}
                  <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                    {nominee.voteCount ?? 0} vote{(nominee.voteCount ?? 0) === 1 ? "" : "s"}
                  </span>
                </CompactListRow>
              );
            })}
          </CompactList>
        )}
        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (selected.length > 0) {
                setConfirmOpen(true);
              } else {
                saveMutation.mutate(selected);
              }
            }}
            disabled={saveMutation.isPending || nominees.length === 0 || isLocked}
            title={isLocked ? "This election is already completed." : undefined}
          >
            {saveMutation.isPending ? "Generating…" : "Generate Result"}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm winner selection</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the election as completed and lock further edits. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                saveMutation.mutate(selected);
              }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
