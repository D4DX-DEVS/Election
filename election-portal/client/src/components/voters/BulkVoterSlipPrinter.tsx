import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Election } from "@/lib/types";
import { getElectionLabel } from "@/lib/electionHelpers";
import { useToast } from "@/hooks/use-toast";
import { Printer, FileDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { buildVoterSlipsPdf } from "@/lib/voterSlipPdf";

type VoterForSlip = {
  _id?: string;
  id?: string;
  username: string;
  fullName?: string | null;
  registrationNumber?: string | null;
  status?: string | null;
  sequenceNumber?: number | null;
  plainPassword?: string | null;
  electionAccess?: string[];
};

interface BulkVoterSlipPrinterProps {
  voters: VoterForSlip[];
  elections: Election[];
  selectedElectionId?: string;
  label?: string;
  className?: string;
  // Optional controlled mode (e.g. opened from a group "Print Slips" button
  // instead of this component's own trigger).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  title?: string;
}

export function BulkVoterSlipPrinter({
  voters,
  elections,
  selectedElectionId,
  label = "Bulk Print Slips",
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  title,
}: BulkVoterSlipPrinterProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp! : internalOpen;
  const setOpen = (o: boolean) => {
    if (isControlled) onOpenChange?.(o);
    else setInternalOpen(o);
  };
  const { toast } = useToast();
  
  // Function to get election names for voters
  const getElectionNamesForVoter = (voter: VoterForSlip) => {
    if (!elections || elections.length === 0) {
      return [];
    }

    // Normalize electionAccess UUIDs to strings
    const voterElectionIds = Array.isArray(voter.electionAccess) 
      ? voter.electionAccess.map(id => id.toString())
      : [];

    // If selectedElectionId is provided and not "all", only return that election
    if (selectedElectionId && selectedElectionId !== "all") {
      const selectedElection = elections.find(election => {
        const electionId = election._id?.toString() || election.id?.toString();
        return electionId === selectedElectionId;
      });
      
      if (selectedElection) {
        return [getElectionLabel(selectedElection)];
      }
      return [];
    }
    
    // If voter doesn't have election access or it's empty, return empty array
    if (!voter.electionAccess || voter.electionAccess.length === 0) {
      return [];
    }

    // Otherwise return all matching elections
    return elections
      .filter(election => {
        const electionId = election._id?.toString() || election.id?.toString();
        return electionId && voterElectionIds.includes(electionId);
      })
      .map((election) => getElectionLabel(election));
  };

  const printBulkSlips = async () => {
    // If we've already filtered on the backend, use all voters
    // They'll already be filtered by the selected election
    let filteredVoters = voters;

    if (filteredVoters.length === 0) {
      toast({
        title: "No voters found",
        description: "There are no voters assigned to the selected election.",
        variant: "destructive"
      });
      return;
    }

    try {
      const missingCredentials = filteredVoters.filter(
        (voter) => !voter.plainPassword && (voter._id || voter.id)
      );
      if (missingCredentials.length) {
        const credentialsById = new Map<string, string>();
        for (let index = 0; index < missingCredentials.length; index += 1000) {
          const voterIds = missingCredentials
            .slice(index, index + 1000)
            .map((voter) => voter._id || voter.id)
            .filter((id): id is string => !!id);
          const response = await apiRequest(
            "POST",
            "/api/users/voters/credentials",
            { voterIds }
          );
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.message || "Could not load voter credentials.");
          }
          (body.data || []).forEach((credential: { id: string; plainPassword?: string | null }) => {
            if (credential.plainPassword) {
              credentialsById.set(String(credential.id), credential.plainPassword);
            }
          });
        }
        filteredVoters = filteredVoters.map((voter) => ({
          ...voter,
          plainPassword:
            voter.plainPassword ||
            (voter._id || voter.id
              ? credentialsById.get(String(voter._id || voter.id))
              : null),
        }));
      }

      const unavailableCount = filteredVoters.filter(
        (voter) => !voter.plainPassword
      ).length;
      if (unavailableCount) {
        throw new Error(
          `${unavailableCount} voter credential(s) are unavailable. Apply the credential migration before reprinting legacy voters.`
        );
      }

      const slipSubtitle = title
        ? title
        : `Election: ${selectedElectionId ? getElectionTitle(selectedElectionId) : "All Elections"} · ${filteredVoters.length} slip(s)`;

      const doc = await buildVoterSlipsPdf(
        filteredVoters.map((voter, index) => ({
          username: voter.username,
          fullName: voter.fullName,
          registrationNumber: voter.registrationNumber,
          plainPassword: voter.plainPassword,
          status: voter.status,
          sequenceNumber: voter.sequenceNumber ?? index + 1,
          electionNames: getElectionNamesForVoter(voter),
        })),
        slipSubtitle
      );

      doc.save(`voter-slips-${new Date().getTime()}.pdf`);

      toast({
        title: "Voter slips generated",
        description: `Successfully generated ${filteredVoters.length} voter slips`,
        variant: "success",
      });

      setOpen(false);
    } catch (error) {
      toast({
        title: "Failed to generate PDF",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  // Helper function to get election title by ID
  const getElectionTitle = (electionId: string): string => {
    const election = elections.find(e => {
      const id = e._id?.toString() || e.id?.toString();
      return id === electionId;
    });
    
    return election ? getElectionLabel(election) : 'Unknown Election';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Printer className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Print Voter Slips</DialogTitle>
          <DialogDescription>
            Generate printable PDF with voter credentials for the {selectedElectionId ? 'selected election' : 'all elections'}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-4">
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="ml-3 flex-1 md:flex md:justify-between">
                <p className="text-sm text-blue-700">
                  This will generate a PDF with up to 10 voter slips per page, formatted for A4 paper.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-md p-4">
            <p className="text-sm font-medium mb-2">Voter slips will include:</p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Username and password</li>
              <li>Serial number (for tracking)</li>
              <li>Election information</li>
              <li>Status</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-md p-4">
            <p className="text-sm font-medium">
              {selectedElectionId 
                ? `Printing voter slips for: ${getElectionTitle(selectedElectionId)}`
                : `Printing slips for all voters (${voters.length})`
              }
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={printBulkSlips}>
            <FileDown className="h-4 w-4 mr-2" />
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
