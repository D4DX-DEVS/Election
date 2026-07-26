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

type VoterForSlip = {
  _id?: string;
  username: string;
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
  const displayPassword = voter.plainPassword || "Not available (shown once, at creation)";

  const printSlip = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Printing failed",
        description: "Failed to open print window. Please check your browser settings.",
        variant: "destructive"
      });
      return;
    }

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Voter Credentials</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
          }
          .slip {
            border: 1px solid #ccc;
            padding: 20px;
            margin-bottom: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
          }
          .subtitle {
            font-size: 16px;
            color: #666;
          }
          .credentials {
            margin: 20px 0;
          }
          .credential-item {
            display: flex;
            margin-bottom: 10px;
          }
          .label {
            font-weight: bold;
            width: 150px;
          }
          .value {
            flex: 1;
          }
          .elections {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #eee;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          .serial {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 12px;
            color: #666;
          }
          @media print {
            .no-print {
              display: none;
            }
            button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="slip">
          <div class="serial">Serial #: ${voter.sequenceNumber || 'N/A'}</div>
          <div class="header">
            <div class="title">Voter Credentials</div>
            <div class="subtitle">Election Management System</div>
          </div>
          
          <div class="credentials">
            <div class="credential-item">
              <div class="label">Username:</div>
              <div class="value">${voter.username}</div>
            </div>
            <div class="credential-item">
              <div class="label">Password:</div>
              <div class="value">${displayPassword}</div>
            </div>
            <div class="credential-item">
              <div class="label">Status:</div>
              <div class="value">${voter.status || 'Active'}</div>
            </div>
          </div>
          
          <div class="elections">
            <div class="label">Available Elections:</div>
            ${electionNames.length > 0 
              ? `<ul>${electionNames.map(name => `<li>${name}</li>`).join('')}</ul>` 
              : '<div>No elections assigned</div>'
            }
          </div>
          
          <div class="footer">
            Please keep these credentials confidential. You will need them to log in and cast your vote.
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print();" style="padding: 10px 20px; background: #4338ca; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Print Slip
          </button>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();

    // Auto-print and close the window after printing
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const copyCredentials = () => {
    const credentials = `
Username: ${voter.username}
Password: ${displayPassword}
Status: ${voter.status || 'Active'}
Elections: ${electionNames.join(', ') || 'None assigned'}
    `;
    
    navigator.clipboard.writeText(credentials.trim()).then(() => {
      toast({
        title: "Copied!",
        description: "Voter credentials copied to clipboard",
      });
    }).catch(err => {
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
            <div className="font-semibold">Username:</div>
            <div className="col-span-2">{voter.username}</div>
            
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
