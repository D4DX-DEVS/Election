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
import jsPDF from "jspdf";
import { apiRequest } from "@/lib/queryClient";

type VoterForSlip = {
  _id?: string;
  id?: string;
  username: string;
  status?: string | null;
  sequenceNumber?: number | null;
  plainPassword?: string | null;
  electionAccess?: string[];
};

// Load the Vote+ logo once and cache it for PDF embedding/watermarking.
let cachedLogo: HTMLImageElement | null = null;
const loadLogo = (): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (cachedLogo) return resolve(cachedLogo);
    const img = new Image();
    img.onload = () => {
      cachedLogo = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });

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

      // Load the Vote+ logo for the header and per-slip watermark.
      const logo = await loadLogo();
      const logoRatio = logo && logo.naturalHeight
        ? logo.naturalWidth / logo.naturalHeight
        : 2.62; // fallback to the wordmark aspect ratio

      // Create a new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Define slip dimensions (2 columns x 5 rows on A4)
      const slipsPerPage = 10;
      const columns = 2;
      const rows = 5;
      const slipWidth = pageWidth / columns - 10; // With margins
      const slipHeight = pageHeight / rows - 10; // With margins

      // Draws a faint, centered Vote+ watermark inside the given slip area.
      const drawWatermark = (sx: number, sy: number) => {
        if (!logo) return;
        const wmWidth = slipWidth * 0.6;
        const wmHeight = wmWidth / logoRatio;
        const wmX = sx + (slipWidth - wmWidth) / 2;
        const wmY = sy + (slipHeight - wmHeight) / 2;
        const anyDoc = doc as any;
        if (anyDoc.GState && anyDoc.setGState) {
          anyDoc.setGState(new anyDoc.GState({ opacity: 0.07 }));
          doc.addImage(logo, 'PNG', wmX, wmY, wmWidth, wmHeight);
          anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
        } else {
          doc.addImage(logo, 'PNG', wmX, wmY, wmWidth, wmHeight);
        }
      };
      
      // Add title to first page
      if (logo) {
        const headerLogoW = 26;
        const headerLogoH = headerLogoW / logoRatio;
        doc.addImage(logo, 'PNG', 10, 4, headerLogoW, headerLogoH);
      }
      doc.setFontSize(16);
      doc.text("Voter Credentials", pageWidth / 2, 10, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`${title ? title : `Election: ${selectedElectionId ? getElectionTitle(selectedElectionId) : 'All Elections'}`}`, pageWidth / 2, 15, { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleDateString("en-GB")}`, pageWidth / 2, 20, { align: 'center' });
      
      // Calculate how many voters to process based on slips per page
      let startY = 25; // Start after header
      let currentPage = 1;
      let votersProcessed = 0;
      
      // Create slips for each voter
      filteredVoters.forEach((voter, index) => {
        // Calculate position on page
        const column = index % columns;
        const row = Math.floor((index % slipsPerPage) / columns);
        
        // If we've filled a page, add a new page
        if (index > 0 && index % slipsPerPage === 0) {
          doc.addPage();
          currentPage++;
          startY = 10; // Reset Y position for new page
        }
        
        const x = 5 + (column * (slipWidth + 5));
        const y = startY + (row * (slipHeight + 5));
        
        // Get election names for this voter
        const electionNames = getElectionNamesForVoter(voter);
        
        // Draw slip border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(x, y, slipWidth, slipHeight);

        // Faint Vote+ watermark behind the slip content
        drawWatermark(x, y);
        
        // Voter Credentials Header
        doc.setFillColor(240, 240, 240);
        doc.rect(x, y, slipWidth, 10, 'F');
        // Vote+ logo in the header bar
        if (logo) {
          const slipLogoW = 16;
          const slipLogoH = slipLogoW / logoRatio;
          doc.addImage(logo, 'PNG', x + 4, y + (10 - slipLogoH) / 2, slipLogoW, slipLogoH);
        }
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text("Voter Credentials", x + 23, y + 7);
        
        // Serial number at top right
        doc.setFontSize(8);
        doc.text(`#${voter.sequenceNumber || index + 1}`, x + slipWidth - 10, y + 7);
        
        // Voter details — dynamic Y so elections always appear before the footer
        const displayPwd = voter.plainPassword || "Not available";
        let lineY = y + 18;
        const lineGap = 6;

        doc.setFontSize(10);
        doc.text(`Username: ${voter.username}`, x + 5, lineY);
        lineY += lineGap;
        doc.text(`Password: ${displayPwd}`, x + 5, lineY);
        lineY += lineGap;
        doc.text(`Status: ${voter.status || 'Active'}`, x + 5, lineY);
        lineY += lineGap;

        doc.setFontSize(10);
        doc.text('Elections:', x + 5, lineY);
        lineY += 5;

        doc.setFontSize(8);
        if (electionNames.length > 0) {
          const maxShown = 2;
          electionNames.slice(0, maxShown).forEach((name) => {
            doc.text(`• ${name}`, x + 10, lineY);
            lineY += 5;
          });
          if (electionNames.length > maxShown) {
            doc.text(`• ... and ${electionNames.length - maxShown} more`, x + 10, lineY);
            lineY += 5;
          }
        } else {
          doc.text('No elections assigned', x + 10, lineY);
          lineY += 5;
        }

        // Footer always below election list (never overlapping bullets)
        const footerY = lineY + 3;
        doc.setFontSize(6);
        doc.text(
          'Please keep these credentials confidential.',
          x + slipWidth / 2,
          footerY,
          { align: 'center' }
        );
        
        votersProcessed++;
      });
      
      // Save the PDF
      doc.save(`voter-slips-${new Date().getTime()}.pdf`);

      toast({
        title: "Voter slips generated",
        description: `Successfully generated ${votersProcessed} voter slips`,
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
