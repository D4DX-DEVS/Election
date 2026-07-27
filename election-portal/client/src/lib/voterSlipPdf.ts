import { jsPDF } from "jspdf";
import { drawPdfHeader, drawPdfFooter, loadAppLogo, LOGO_ALIAS, PDF_NAVY, PDF_GRID } from "@/lib/pdfBranding";

export interface VoterSlipData {
  username: string;
  fullName?: string | null;
  registrationNumber?: string | null;
  plainPassword?: string | null;
  status?: string | null;
  sequenceNumber?: number | null;
  electionNames: string[];
}

const COLUMNS = 2;
const ROWS = 3;
const SLIPS_PER_PAGE = COLUMNS * ROWS;

/**
 * Renders every voter as an identical "report card" slip, laid out in a grid
 * across A4 pages. Used for both single-voter and bulk credential printing so
 * both paths produce the exact same design.
 */
export async function buildVoterSlipsPdf(
  voters: VoterSlipData[],
  subtitle?: string
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  const logo = await loadAppLogo();
  const logoRatio = logo ? logo.width / logo.height : 2.62;

  const pageSubtitle = subtitle || `${voters.length} slip(s)`;
  const gridTop = await drawPdfHeader(doc, "Voter Credentials", pageSubtitle);
  const gridBottom = pageHeight - 20;
  const slipWidth = (pageWidth - margin * 2 - (COLUMNS - 1) * 6) / COLUMNS;
  const slipHeight = (gridBottom - gridTop - (ROWS - 1) * 6) / ROWS;

  // Reuse one GState object across every watermark draw instead of allocating per-slip.
  const anyDoc = doc as any;
  const watermarkGState = anyDoc.GState ? new anyDoc.GState({ opacity: 0.06 }) : null;
  const opaqueGState = anyDoc.GState ? new anyDoc.GState({ opacity: 1 }) : null;

  const drawWatermark = (sx: number, sy: number) => {
    if (!logo) return;
    const wmWidth = slipWidth * 0.55;
    const wmHeight = wmWidth / logoRatio;
    const wmX = sx + (slipWidth - wmWidth) / 2;
    const wmY = sy + (slipHeight - wmHeight) / 2;
    if (watermarkGState && anyDoc.setGState) {
      anyDoc.setGState(watermarkGState);
      doc.addImage(logo.source, "PNG", wmX, wmY, wmWidth, wmHeight, LOGO_ALIAS);
      anyDoc.setGState(opaqueGState);
    } else {
      doc.addImage(logo.source, "PNG", wmX, wmY, wmWidth, wmHeight, LOGO_ALIAS);
    }
  };

  for (let index = 0; index < voters.length; index += 1) {
    const voter = voters[index];
    const slotIndex = index % SLIPS_PER_PAGE;
    if (index > 0 && slotIndex === 0) {
      doc.addPage();
      await drawPdfHeader(doc, "Voter Credentials", pageSubtitle);
    }
    const column = slotIndex % COLUMNS;
    const row = Math.floor(slotIndex / COLUMNS);
    const x = margin + column * (slipWidth + 6);
    const y = gridTop + row * (slipHeight + 6);

    // Card border
    doc.setDrawColor(...PDF_GRID);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, slipWidth, slipHeight, 2, 2);

    // Faint watermark
    drawWatermark(x, y);

    // Header bar
    const headerBarHeight = 11;
    doc.setFillColor(...PDF_NAVY);
    doc.rect(x, y, slipWidth, headerBarHeight, "F");
    if (logo) {
      const slipLogoW = 14;
      const slipLogoH = slipLogoW / logoRatio;
      doc.addImage(logo.source, "PNG", x + 4, y + (headerBarHeight - slipLogoH) / 2, slipLogoW, slipLogoH, LOGO_ALIAS);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Voter Credentials", x + (logo ? 21 : 5), y + 7.3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`#${voter.sequenceNumber ?? index + 1}`, x + slipWidth - 4, y + 7.3, { align: "right" });

    // Body
    const labelX = x + 5;
    let lineY = y + headerBarHeight + 6.5;

    // Name — full width, ID-card style
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(20, 20, 20);
    const nameText = voter.fullName?.trim() || voter.username;
    doc.text(nameText, labelX, lineY, { maxWidth: slipWidth - 10 });
    lineY += 6;

    // Two-column field grid: Username/Reg No, Password/Status
    const colRightX = x + slipWidth / 2 + 3;
    const fieldGap = 5.5;

    const field = (fx: number, label: string, value: string, bold = false) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(label.toUpperCase(), fx, lineY);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      doc.text(value, fx, lineY + 3.6, { maxWidth: slipWidth / 2 - 8 });
    };

    field(labelX, "Username", voter.username);
    field(colRightX, "Reg. No.", voter.registrationNumber || "—");
    lineY += fieldGap + 3.6;
    field(labelX, "Password", voter.plainPassword || "Not available", true);
    field(colRightX, "Status", voter.status || "active");
    lineY += fieldGap + 3.6;

    lineY += 1;
    doc.setDrawColor(...PDF_GRID);
    doc.setLineWidth(0.2);
    doc.line(labelX, lineY - 4, x + slipWidth - 5, lineY - 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Elections", labelX, lineY);
    lineY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
    if (voter.electionNames.length > 0) {
      const maxShown = 2;
      voter.electionNames.slice(0, maxShown).forEach((name) => {
        doc.text(`• ${name}`, labelX + 2, lineY);
        lineY += 4.5;
      });
      if (voter.electionNames.length > maxShown) {
        doc.setTextColor(130, 130, 130);
        doc.text(`+ ${voter.electionNames.length - maxShown} more`, labelX + 2, lineY);
        lineY += 4.5;
      }
    } else {
      doc.setTextColor(150, 150, 150);
      doc.text("No elections assigned", labelX + 2, lineY);
      lineY += 4.5;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Keep these credentials confidential.",
      x + slipWidth / 2,
      y + slipHeight - 3,
      { align: "center" }
    );
  }

  drawPdfFooter(doc);
  return doc;
}
