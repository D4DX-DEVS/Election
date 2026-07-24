import jsPDF from "jspdf";

export interface ResultPdfNominee {
  name: string;
  gender?: string;
  voteCount?: number;
  percentage?: number;
  isElected?: boolean;
}

export interface ResultPdfData {
  totalBallots?: number;
  eligibleVoters?: number;
  turnout?: number;
  nominees?: ResultPdfNominee[];
}

interface GenerateResultPdfOptions {
  electionTitle?: string;
  organization?: string;
  electionDate?: string | Date;
  results: ResultPdfData | null;
  numberToBeElected?: number;
  genderBasedSelection?: boolean;
  preparedBy?: string;
  mode?: "download" | "print";
}

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
    img.src = "/logo.png";
  });

const fmtDate = (date?: string | Date | null) => {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(date);
  }
};

export async function generateElectionResultPdf({
  electionTitle,
  organization,
  electionDate,
  results,
  numberToBeElected = 1,
  genderBasedSelection = false,
  preparedBy = "",
  mode = "download",
}: GenerateResultPdfOptions) {
  const logo = await loadLogo();
  const logoRatio = logo && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 2.62;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const navy: [number, number, number] = [10, 36, 99];
  const red: [number, number, number] = [225, 29, 42];

  if (logo) {
    const logoWidth = 34;
    const logoHeight = logoWidth / logoRatio;
    doc.addImage(logo, "PNG", margin, 12, logoWidth, logoHeight);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text("ELECTION RESULT", pageWidth - margin, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Official Result Summary", pageWidth - margin, 24, { align: "right" });

  doc.setDrawColor(navy[0], navy[1], navy[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, 30, pageWidth - margin, 30);

  let y = 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(electionTitle || "Election", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  if (organization) {
    doc.text(organization, pageWidth / 2, y, { align: "center" });
    y += 6;
  }
  if (electionDate) {
    doc.setFontSize(10);
    doc.text(`Election Date: ${fmtDate(electionDate)}`, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  y += 4;
  const tileWidth = (pageWidth - margin * 2 - 8) / 3;
  const tileHeight = 20;
  const summary = [
    { label: "Eligible Voters", value: String(results?.eligibleVoters ?? 0) },
    { label: "Votes Cast", value: String(results?.totalBallots ?? 0) },
    { label: "Turnout", value: `${results?.turnout ?? 0}%` },
  ];

  summary.forEach((item, index) => {
    const tileX = margin + index * (tileWidth + 4);
    doc.setFillColor(244, 246, 251);
    doc.setDrawColor(225, 228, 236);
    doc.setLineWidth(0.3);
    doc.roundedRect(tileX, y, tileWidth, tileHeight, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(item.value, tileX + tileWidth / 2, y + 9, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(item.label, tileX + tileWidth / 2, y + 15, { align: "center" });
  });
  y += tileHeight + 10;

  const sorted = [...(results?.nominees || [])].sort(
    (first, second) => (second.voteCount || 0) - (first.voteCount || 0),
  );

  const cols = genderBasedSelection
    ? [
        { title: "Rank", x: margin, w: 14, align: "center" as const },
        { title: "Nominee", x: margin + 14, w: 74, align: "left" as const },
        { title: "Gender", x: margin + 88, w: 22, align: "left" as const },
        { title: "Votes", x: margin + 110, w: 20, align: "right" as const },
        { title: "%", x: margin + 130, w: 18, align: "right" as const },
        { title: "Result", x: margin + 148, w: pageWidth - margin - (margin + 148), align: "center" as const },
      ]
    : [
        { title: "Rank", x: margin, w: 16, align: "center" as const },
        { title: "Nominee", x: margin + 16, w: 90, align: "left" as const },
        { title: "Votes", x: margin + 106, w: 22, align: "right" as const },
        { title: "%", x: margin + 128, w: 20, align: "right" as const },
        { title: "Result", x: margin + 148, w: pageWidth - margin - (margin + 148), align: "center" as const },
      ];

  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 9;
  const tableTop = y;

  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(margin, y, tableWidth, rowHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  cols.forEach((col) => {
    const colX = col.align === "right" ? col.x + col.w - 3 : col.align === "center" ? col.x + col.w / 2 : col.x + 3;
    doc.text(col.title, colX, y + 6, { align: col.align });
  });
  y += rowHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  sorted.forEach((nominee, index) => {
    // Prefer the server's quota-aware winner flag; fall back to rank.
    const elected = typeof nominee.isElected === "boolean"
      ? nominee.isElected
      : index < numberToBeElected;
    if (y + rowHeight > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    if (elected) {
      doc.setFillColor(232, 245, 233);
    } else {
      const shade = index % 2 === 0 ? 255 : 249;
      doc.setFillColor(shade, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    }
    doc.rect(margin, y, tableWidth, rowHeight, "F");
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);
    doc.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);

    doc.setTextColor(elected ? 22 : 40, elected ? 101 : 40, elected ? 52 : 40);
    const resultColumnIndex = genderBasedSelection ? 5 : 4;
    const values = genderBasedSelection
      ? [
          String(index + 1),
          nominee.name || "-",
          nominee.gender ? nominee.gender.charAt(0).toUpperCase() + nominee.gender.slice(1) : "-",
          String(nominee.voteCount ?? 0),
          `${(nominee.percentage ?? 0).toFixed(1)}%`,
          elected ? "ELECTED" : "-",
        ]
      : [
          String(index + 1),
          nominee.name || "-",
          String(nominee.voteCount ?? 0),
          `${(nominee.percentage ?? 0).toFixed(1)}%`,
          elected ? "ELECTED" : "-",
        ];

    cols.forEach((col, colIndex) => {
      if (colIndex === 1 || colIndex === resultColumnIndex) doc.setFont("helvetica", elected ? "bold" : "normal");
      else doc.setFont("helvetica", "normal");
      const colX = col.align === "right" ? col.x + col.w - 3 : col.align === "center" ? col.x + col.w / 2 : col.x + 3;
      doc.text(values[colIndex], colX, y + 6, { align: col.align });
    });
    y += rowHeight;
  });

  doc.setDrawColor(navy[0], navy[1], navy[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, tableTop, tableWidth, rowHeight * (sorted.length + 1));

  if (sorted.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.text("No nominees / votes recorded.", pageWidth / 2, y + 8, { align: "center" });
    y += 12;
  }

  let signY = pageHeight - 36;
  if (y + 30 > signY) signY = y + 20;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 60, signY, pageWidth - margin, signY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(preparedBy ? preparedBy : "Authorised Signatory", pageWidth - margin - 30, signY + 5, {
    align: "center",
  });
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("Prepared by", pageWidth - margin - 30, signY + 10, { align: "center" });

  doc.setDrawColor(225, 228, 236);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated on ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`, margin, pageHeight - 11);
  doc.setTextColor(red[0], red[1], red[2]);
  doc.setFont("helvetica", "bold");
  doc.text("Powered by Vote+", pageWidth - margin, pageHeight - 11, { align: "right" });

  if (mode === "print") {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
    return;
  }

  const safeTitle = (electionTitle || "election").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`result-${safeTitle}-${Date.now()}.pdf`);
}
