import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResultsTable } from "@/components/analytics/ResultsTable";
import { VotingStats } from "@/components/analytics/VotingStats";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getElectionLabel } from "@/lib/electionHelpers";
import { generateElectionResultPdf } from "@/lib/resultPdf";
import { AdminVotingDetailsPanel } from "@/components/elections/AdminVotingDetailsPanel";
import { ManualWinnerPicker } from "@/components/elections/ManualWinnerPicker";
import { Download, Printer } from "lucide-react";

export default function Analytics({ embedded = false, electionId }: { embedded?: boolean; electionId?: string } = {}) {
  const [selectedElectionId, setSelectedElectionId] = useState<string>(electionId || "");
  const [resultAction, setResultAction] = useState<"print" | "export" | null>(null);
  const [preparedBy, setPreparedBy] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (electionId) {
      setSelectedElectionId(electionId);
    }
  }, [electionId]);

  // Fetch elections for the selector (real data)
  const { data: electionsResponse } = useQuery({
    queryKey: ['/api/elections'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/elections');
      return res.json();
    },
  });
  const elections = Array.isArray(electionsResponse?.data) ? electionsResponse.data : [];

  // Fetch real election results (vote tally per nominee)
  const { data: resultsResponse, isLoading: resultsLoading } = useQuery({
    queryKey: ['/api/vote/results', selectedElectionId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/vote/results/${selectedElectionId}`);
      return res.json();
    },
    enabled: !!selectedElectionId,
  });

  const results = resultsResponse?.data || null;
  const nomineesWithVotes = results?.nominees || [];
  const selectedElection = results?.election || elections.find((e: any) => e._id === selectedElectionId);
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

  const handleLoadResults = () => {
    if (selectedElectionId) {
      toast({
        title: "Results loaded",
        description: `Loaded results for the selected election`,
      });
    } else {
      toast({
        title: "No election selected",
        description: "Please select an election to load results",
        variant: "destructive",
      });
    }
  };

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

  useEffect(() => {
    if (!embedded) document.title = "Analytics | Vote+";
  }, [embedded]);

  const Wrapper = embedded ? Fragment : MainLayout;

  return (
    <Wrapper>
      {!embedded && (
      <div className="mb-6">
        <h1 className="app-page-title">Election Analytics</h1>
        <p className="text-sm text-gray-600">Detailed results and voting statistics</p>
      </div>
      )}

      {!embedded && (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <Label htmlFor="election-select">Select Election</Label>
              <Select 
                value={selectedElectionId} 
                onValueChange={setSelectedElectionId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select an election" />
                </SelectTrigger>
                <SelectContent>
                  {elections?.map((election: any) => (
                    <SelectItem key={election._id} value={election._id}>
                      {getElectionLabel(election)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                className="w-full" 
                onClick={handleLoadResults}
                disabled={!selectedElectionId}
              >
                Load Results
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {selectedElectionId && analytics && !analyticsLoading && (
        <>
          {!embedded && selectedElection?.manualWinnerSelection && (
            <ManualWinnerPicker
              electionId={selectedElectionId}
              enabled
              numberToBeElected={selectedElection.numberToBeElected || 1}
              nominees={nomineesWithVotes}
              manualWinnerIds={selectedElection.manualWinnerIds || []}
            />
          )}
          {!embedded && selectedElection?.adminVotingDetailsEnabled && (
            <AdminVotingDetailsPanel electionId={selectedElectionId} enabled />
          )}
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
        </>
      )}

      {selectedElectionId && (!analytics || analyticsLoading) && (
        <div className="text-center py-8">
          <p>Loading analytics data...</p>
        </div>
      )}

      {!selectedElectionId && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Election Selected</h3>
          <p className="text-gray-500 mb-4">Please select an election to view analytics</p>
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
    </Wrapper>
  );
}
