import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResultsTable } from "@/components/analytics/ResultsTable";
import { VotingStats } from "@/components/analytics/VotingStats";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getElectionLabel } from "@/lib/electionHelpers";
import { generateElectionResultPdf } from "@/lib/resultPdf";
import { Download, Printer } from "lucide-react";

/** Always rendered embedded inside ElectionWorkspace's Results & Analytics tab for one election at a time. */
export default function Analytics({ electionId }: { electionId: string }) {
  const selectedElectionId = electionId;
  const [resultAction, setResultAction] = useState<"print" | "export" | null>(null);
  const [preparedBy, setPreparedBy] = useState("");
  const { toast } = useToast();

  // Fetch real election results (vote tally per nominee) — poll while voting
  // is open so tallies stay live as other voters cast/revote or an admin
  // edits a ballot, without requiring a manual page refresh.
  const { data: resultsResponse, isLoading: resultsLoading } = useQuery({
    queryKey: ['/api/vote/results', selectedElectionId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/vote/results/${selectedElectionId}`);
      return res.json();
    },
    enabled: !!selectedElectionId,
    refetchInterval: (query) => (query.state.data as any)?.data?.election?.votingOpen ? 15000 : false,
  });

  const results = resultsResponse?.data || null;
  const nomineesWithVotes = results?.nominees || [];
  const selectedElection = results?.election;
  const analytics = results
    ? {
        totalVoters: results.eligibleVoters || 0,
        totalVotesCast: results.totalBallots || 0,
        pendingVoters: Math.max((results.eligibleVoters || 0) - (results.totalBallots || 0), 0),
        isFinalized: !!selectedElection?.resultsPublished,
      }
    : null;
  const analyticsLoading = resultsLoading;
  const nomineesLoading = resultsLoading;

  const openResultAction = (action: "print" | "export") => {
    if (!results || !selectedElection) {
      toast({
        title: "No results loaded",
        description: "Please load an election result first.",
        variant: "destructive",
      });
      return;
    }
    setResultAction(action);
  };

  const handleGenerateResultDocument = async () => {
    if (!resultAction || !results || !selectedElection) return;
    try {
      await generateElectionResultPdf({
        electionTitle: getElectionLabel(selectedElection),
        organization: selectedElection.organization,
        electionDate: selectedElection.electionDate,
        results,
        numberToBeElected: selectedElection.numberToBeElected || 1,
        genderBasedSelection: !!selectedElection.genderBasedSelection,
        preparedBy,
        mode: resultAction === "print" ? "print" : "download",
      });
      toast({
        title: resultAction === "print" ? "Result ready to print" : "Result PDF exported",
        description: resultAction === "print" ? "The printable result opened in a new tab." : "The election result has been downloaded.",
        variant: "success",
      });
      setResultAction(null);
    } catch (err: any) {
      toast({
        title: "Failed to generate result",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/analytics/remind/${selectedElectionId}`);
      return res.json();
    },
    onSuccess: (body) => {
      const data = body?.data;
      toast({
        title: data?.emailsSent ? "Reminders sent" : "Reminder summary",
        description: data?.message || "Reminder request completed.",
        variant: data?.emailsSent ? "success" : "default",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not send reminders",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSendReminder = () => {
    if (!selectedElectionId) {
      toast({
        title: "No election selected",
        description: "Select an election first.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedElection?.votingOpen) {
      toast({
        title: "Voting is closed",
        description: "Reminders can only be sent while voting is open.",
        variant: "destructive",
      });
      return;
    }
    if ((analytics?.pendingVoters ?? 0) === 0) {
      toast({
        title: "No pending voters",
        description: "All assigned voters have already cast their ballots.",
      });
      return;
    }
    sendReminderMutation.mutate();
  };

  return (
    <>
      {selectedElectionId && analytics && !analyticsLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            {nomineesWithVotes && selectedElection && !nomineesLoading && (
              <ResultsTable
                nominees={nomineesWithVotes}
                numberToBeElected={selectedElection.numberToBeElected}
                onPrint={() => openResultAction("print")}
                onExport={() => openResultAction("export")}
              />
            )}
          </div>
          <div>
            <VotingStats
              analytics={analytics as any}
              electionDate={selectedElection?.electionDate ? new Date(selectedElection.electionDate) : undefined}
              onSendReminder={handleSendReminder}
              sendReminderPending={sendReminderMutation.isPending}
              votingOpen={!!selectedElection?.votingOpen}
            />
          </div>
        </div>
      )}

      {(!analytics || analyticsLoading) && (
        <div className="text-center py-8">
          <p>Loading analytics data...</p>
        </div>
      )}

      <Dialog open={!!resultAction} onOpenChange={(open) => !open && setResultAction(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultAction === "print" ? (
                <Printer className="h-5 w-5 text-primary" />
              ) : (
                <Download className="h-5 w-5 text-primary" />
              )}
              {resultAction === "print" ? "Print Election Result" : "Export Election Result"}
            </DialogTitle>
            <DialogDescription>
              Generates the same standard A4 result sheet with election details and the Vote+ logo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="analyticsPreparedBy">Prepared by / Returning Officer (optional)</Label>
              <Input
                id="analyticsPreparedBy"
                placeholder="e.g. John Mathew"
                value={preparedBy}
                onChange={(event) => setPreparedBy(event.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                This name appears above the signature line on the printed/exported sheet.
              </p>
            </div>
            <div className="rounded-md bg-white p-3 text-xs text-gray-600">
              {results?.nominees?.length || 0} nominees · {results?.totalBallots ?? 0} votes · {results?.turnout ?? 0}% turnout
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultAction(null)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateResultDocument}>
              {resultAction === "print" ? (
                <Printer className="h-4 w-4 mr-1.5" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              {resultAction === "print" ? "Print" : "Export PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
