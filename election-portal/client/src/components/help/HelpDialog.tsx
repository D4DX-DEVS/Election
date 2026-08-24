import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileDown, HelpCircle, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HelpSection {
  title: string;
  steps: string[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrator",
  franchise_admin: "Franchise Administrator",
  election_admin: "Election Administrator",
  voter: "Voter",
};

// Role-based "how to use" content. Kept in one place so the on-screen guide and
// the downloadable PDF stay in sync.
const HELP_CONTENT: Record<string, HelpSection[]> = {
  super_admin: [
    {
      title: "Manage franchises",
      steps: [
        "Open the Franchises page from the sidebar.",
        "Click ‘Create Franchise’ and fill in the name, logo and contact details.",
        "Use ‘Manage Admin’ to add a franchise administrator who will run elections.",
      ],
    },
    {
      title: "Oversee administrators",
      steps: [
        "Go to the Administrators page to create franchise or election admins.",
        "Reset a password from the admin’s actions menu when needed.",
      ],
    },
    {
      title: "Monitor everything",
      steps: [
        "Use the Dashboard for an overview of elections and activity.",
        "Open any election workspace to review nominees, votes and results.",
      ],
    },
  ],
  franchise_admin: [
    {
      title: "Create an election",
      steps: [
        "Open Elections and click ‘Create Election’.",
        "Set the title, organization, positions and the number to be elected.",
        "Choose settings such as gender-based selection and voter result display.",
      ],
    },
    {
      title: "Add voters & nominees",
      steps: [
        "Create voter groups, then generate or add voters under each group.",
        "Add nominees to the election (individually, in bulk, or imported).",
        "Print voter slips so each voter receives their login details.",
      ],
    },
    {
      title: "Run voting & publish results",
      steps: [
        "Open the voting window when you are ready to collect votes.",
        "Close voting once everyone has voted.",
        "Publish results so voters can view them, and print the official result PDF.",
      ],
    },
  ],
  election_admin: [
    {
      title: "Prepare the election",
      steps: [
        "Open your assigned election from the Elections page.",
        "Add and review nominees for each position.",
      ],
    },
    {
      title: "Manage voting",
      steps: [
        "Open the voting window when the election starts.",
        "Track turnout from the election workspace.",
        "Close voting and publish the result when finished.",
      ],
    },
  ],
  voter: [
    {
      title: "Sign in",
      steps: [
        "Use the User ID and password printed on your voter slip.",
        "Keep your details private — your vote is secret.",
      ],
    },
    {
      title: "Cast your vote",
      steps: [
        "Open the Voting page to see the elections available to you.",
        "Select your candidate(s) up to the allowed number for each position.",
        "Review your selection and submit. You can vote only once per election.",
      ],
    },
    {
      title: "View results",
      steps: [
        "After results are published, open the Results page to see the outcome.",
      ],
    },
  ],
};

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const user = useMemo(() => getStoredUser(), [open]);
  const role: string = user?.role || "voter";
  const roleLabel = ROLE_LABELS[role] || "User";
  const userName = user?.fullName || user?.username || "User";
  const userId = user?.username || user?.id || "—";
  const sections = HELP_CONTENT[role] || HELP_CONTENT.voter;

  const loadLogo = (): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = "/logo.png";
    });

  const downloadGuide = async () => {
    setGenerating(true);
    try {
      const navy: [number, number, number] = [10, 36, 99];
      const red: [number, number, number] = [225, 29, 42];
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 48;
      let y = margin;

      // Header band
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageWidth, 96, "F");
      const logo = await loadLogo();
      if (logo) {
        const lw = 54;
        const lh = (logo.height / logo.width) * lw || 54;
        try {
          doc.addImage(logo, "PNG", margin, 24, lw, Math.min(lh, 52));
        } catch {
          /* ignore logo failures */
        }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("How to Use Vote+", pageWidth - margin, 44, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`${roleLabel} Guide`, pageWidth - margin, 66, { align: "right" });

      y = 128;

      // Personalized line
      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`Prepared for: ${userName}`, margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text(`User ID: ${userId}`, margin, y);
      doc.text(
        `Generated: ${new Date().toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          hour12: true,
        })}`,
        pageWidth - margin,
        y,
        { align: "right" }
      );
      y += 14;
      doc.setDrawColor(...red);
      doc.setLineWidth(1.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 28;

      // Sections
      sections.forEach((section, sIdx) => {
        if (y > pageHeight - 120) {
          doc.addPage();
          y = margin;
        }
        doc.setTextColor(...navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(`${sIdx + 1}. ${section.title}`, margin, y);
        y += 20;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        section.steps.forEach((step) => {
          const lines = doc.splitTextToSize(`•  ${step}`, pageWidth - margin * 2 - 12);
          if (y > pageHeight - 90) {
            doc.addPage();
            y = margin;
          }
          doc.text(lines, margin + 12, y);
          y += lines.length * 15 + 4;
        });
        y += 12;
      });

      // Footer on every page
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 48, pageWidth - margin, pageHeight - 48);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(140, 140, 140);
        doc.text("Powered by Vote+", margin, pageHeight - 32);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 32, {
          align: "right",
        });
      }

      const safeName = String(userId).replace(/[^a-z0-9_-]+/gi, "_");
      doc.save(`How-to-Use-Vote+_${safeName}.pdf`);
      toast({
        title: "Guide downloaded",
        description: "Your personalized how-to-use document has been saved.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Could not generate guide",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[rgb(10,36,99)]">
            <HelpCircle className="h-5 w-5" />
            How to use Vote+
          </DialogTitle>
          <DialogDescription>
            A quick guide tailored to your role as <span className="font-medium">{roleLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {sections.map((section, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(10,36,99)]/10 text-xs font-bold text-[rgb(10,36,99)]">
                  {idx + 1}
                </span>
                {section.title}
              </h3>
              <ul className="space-y-1.5 pl-1">
                {section.steps.map((step, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            onClick={downloadGuide}
            disabled={generating}
            className="w-full sm:w-auto bg-[rgb(10,36,99)] hover:bg-[rgb(8,28,78)]"
          >
            <FileDown className="mr-2 h-4 w-4" />
            {generating ? "Generating…" : "Download guide (PDF)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
