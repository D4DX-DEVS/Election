import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Printer, Download, CheckCircle2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generateElectionResultPdf } from "@/lib/resultPdf";

interface ResultNominee {
  name: string;
  gender?: string;
  voteCount?: number;
  percentage?: number;
}

interface ElectionResultActionsProps {
  electionId: string;
  electionTitle?: string;
  organization?: string;
  electionDate?: string | Date;
  resultsPublished?: boolean;
  resultsPublishedAt?: string | Date | null;
  results: {
    totalBallots?: number;
    eligibleVoters?: number;
    turnout?: number;
    nominees?: ResultNominee[];
  } | null;
  numberToBeElected?: number;
  genderBasedSelection?: boolean;
}

export function ElectionResultActions({
  electionId,
  electionTitle,
  organization,
  electionDate,
  resultsPublished = false,
  resultsPublishedAt,
  results,
  numberToBeElected = 1,
  genderBasedSelection = false,
}: ElectionResultActionsProps) {
  const { toast } = useToast();
  const [printOpen, setPrintOpen] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");

  const publishMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const res = await apiRequest("PATCH", `/api/elections/${electionId}/publish`, { publish });
      return res.json();
    },
    onSuccess: (_data, publish) => {
      queryClient.invalidateQueries({ queryKey: [`/api/elections/${electionId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      toast({
        title: publish ? "Results published" : "Results hidden",
        description: publish
          ? "Voters can now view the result of this election."
          : "The result is no longer visible to voters.",
        variant: publish ? "success" : "default",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Action failed",
        description: err?.message || "Could not update result visibility.",
        variant: "destructive",
      });
    },
  });

  const fmtDate = (d?: string | Date | null) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return String(d);
    }
  };

  const pdfOptions = {
    electionTitle,
    organization,
    electionDate,
    results,
    numberToBeElected,
    genderBasedSelection,
    preparedBy,
  };

  const handlePrint = async () => {
    try {
      await generateElectionResultPdf({ ...pdfOptions, mode: "print" });
      setPrintOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed to generate PDF",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    try {
      await generateElectionResultPdf({ ...pdfOptions, mode: "download" });
      setPrintOpen(false);
      toast({
        title: "Result PDF downloaded",
        description: "The election result has been saved to your device.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Failed to generate PDF",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                resultsPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {resultsPublished ? <Globe className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="app-section-title">Result visible to voters</h3>
                {resultsPublished ? (
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-100 text-gray-700">
                    Hidden
                  </Badge>
                )}
              </div>
              <p className="app-helper mt-0.5 max-w-md">
                {resultsPublished
                  ? "Voters can now see the full result tally for this election."
                  : "Enable this to let voters view the result. They will only see vote counts, no private details."}
              </p>
              {resultsPublished && resultsPublishedAt && (
                <p className="app-muted mt-0.5">
                  Published on {fmtDate(resultsPublishedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant={resultsPublished ? "outline" : "default"}
                  size="sm"
                  disabled={publishMutation.isPending}
                >
                  {resultsPublished ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1.5" /> Hide Result
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1.5" /> Enable / Publish
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {resultsPublished ? "Hide result from voters?" : "Make the result public?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {resultsPublished
                      ? "Voters will no longer be able to see the result tally for this election."
                      : "Do you want to confirm and make the result public? Voters who can access this election will be able to view the full vote tally."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => publishMutation.mutate(!resultsPublished)}>
                    {resultsPublished ? "Yes, hide it" : "Yes, publish"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              <Printer className="h-4 w-4 mr-1.5" /> Print / Export
            </Button>
          </div>
        </div>

        {/* Print / Export dialog */}
        <Dialog open={printOpen} onOpenChange={setPrintOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" /> Print / Export Result
              </DialogTitle>
              <DialogDescription>
                Generates a standard A4 result sheet with the election name and Vote+ logo. Choose
                to print directly or save as a PDF file.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="preparedBy">Prepared by / Returning Officer (optional)</Label>
                <Input
                  id="preparedBy"
                  placeholder="e.g. John Mathew"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="mt-1"
                />
                <p className="app-helper mt-1">
                  This name appears above the signature line on the printed sheet.
                </p>
              </div>
              <div className="rounded-md bg-white p-3 app-muted flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                {results?.nominees?.length || 0} nominees · {results?.totalBallots ?? 0} votes ·{" "}
                {results?.turnout ?? 0}% turnout
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPrintOpen(false)}>
                Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download PDF
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5 mr-1" /> Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
