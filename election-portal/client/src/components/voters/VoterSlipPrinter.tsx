import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Printer, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildVoterSlipsPdf } from "@/lib/voterSlipPdf";

type VoterForSlip = {
  _id?: string;
  username: string;
  fullName?: string | null;
  registrationNumber?: string | null;
  status?: string | null;
  sequenceNumber?: number | null;
  plainPassword?: string | null;
};

interface VoterSlipPrinterProps {
  voter: VoterForSlip;
  electionNames: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function VoterSlipPrinter({
  voter,
  electionNames,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: VoterSlipPrinterProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { toast } = useToast();

  // Plaintext passwords are never persisted (only bcrypt hashes are stored),
  // so this is only available right after the voter was created.
  const displayPassword = voter.plainPassword || "Not available";

  const printSlip = async () => {
    try {
      const doc = await buildVoterSlipsPdf([
        {
          username: voter.username,
          fullName: voter.fullName,
          registrationNumber: voter.registrationNumber,
          plainPassword: voter.plainPassword,
          status: voter.status,
          sequenceNumber: voter.sequenceNumber,
          electionNames,
        },
      ]);
      doc.autoPrint();
      const url = doc.output("bloburl");
      const printWindow = window.open(url as unknown as string, "_blank");
      if (!printWindow) {
        toast({
          title: "Printing failed",
          description: "Failed to open print window. Please check your browser settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Printing failed",
        description: error instanceof Error ? error.message : "Could not generate the slip.",
        variant: "destructive",
      });
    }
  };

  const copyCredentials = () => {
    const credentials = `
Name: ${voter.fullName?.trim() || voter.username}
Username: ${voter.username}
Reg. No.: ${voter.registrationNumber || '—'}
Password: ${displayPassword}
Status: ${voter.status || 'Active'}
Elections: ${electionNames.join(', ') || 'None assigned'}
    `;
    
    navigator.clipboard.writeText(credentials.trim()).then(() => {
      toast({
        title: "Copied!",
        description: "Voter credentials copied to clipboard",
      });
    }).catch(() => {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive"
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-gray-700 hover:bg-primary/10"
          aria-label="Print voter slip"
          title="Print voter slip"
        >
          <Printer className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Voter Credentials</DialogTitle>
        </DialogHeader>
        
        <div className="border rounded-md p-4 my-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="font-semibold">Name:</div>
            <div className="col-span-2">{voter.fullName?.trim() || voter.username}</div>

            <div className="font-semibold">Username:</div>
            <div className="col-span-2">{voter.username}</div>

            <div className="font-semibold">Reg. No.:</div>
            <div className="col-span-2">{voter.registrationNumber || '—'}</div>

            <div className="font-semibold">Password:</div>
            <div className="col-span-2">{displayPassword}</div>

            <div className="font-semibold">Serial #:</div>
            <div className="col-span-2">{voter.sequenceNumber || 'N/A'}</div>

            <div className="font-semibold">Status:</div>
            <div className="col-span-2 capitalize">{voter.status || 'Active'}</div>
            
            <div className="font-semibold">Elections:</div>
            <div className="col-span-2">
              {electionNames.length > 0 ? (
                <ul className="list-disc pl-5">
                  {electionNames.map((name, index) => (
                    <li key={index}>{name}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500">No elections assigned</span>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <Button variant="outline" onClick={copyCredentials}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button onClick={printSlip}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
