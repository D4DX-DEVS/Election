import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";

export const PDF_NAVY: [number, number, number] = [10, 36, 99];
export const PDF_RED: [number, number, number] = [225, 29, 42];
export const PDF_GRID: [number, number, number] = [225, 228, 236];

/** Stable cache key so jsPDF embeds the logo's pixel data once per document, not on every draw call. */
export const LOGO_ALIAS = "voteplus-logo";

export interface LogoAsset {
  /** Downscaled bitmap — small enough that repeated addImage() calls stay cheap. */
  source: HTMLCanvasElement;
  width: number;
  height: number;
}

let cachedLogo: LogoAsset | null | undefined;
let pendingLogo: Promise<LogoAsset | null> | null = null;

const MAX_LOGO_WIDTH = 260; // px — plenty for a ~35mm print at PDF resolution

function downscaleLogo(img: HTMLImageElement): LogoAsset {
  const ratio = img.naturalWidth / img.naturalHeight || 2.62;
  const width = Math.min(img.naturalWidth, MAX_LOGO_WIDTH);
  const height = Math.round(width / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, width, height);
  return { source: canvas, width, height };
}

export const loadAppLogo = (): Promise<LogoAsset | null> => {
  if (cachedLogo !== undefined) return Promise.resolve(cachedLogo);
  if (pendingLogo) return pendingLogo;

  pendingLogo = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cachedLogo = downscaleLogo(img);
      resolve(cachedLogo);
    };
    img.onerror = () => {
      cachedLogo = null;
      resolve(null);
    };
    img.src = "/logo.png";
  });
  return pendingLogo;
};

function formatGeneratedAt() {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Draws the shared Vote+ letterhead (logo + title + subtitle + rule line).
 * Returns the Y position to start content below the header.
 */
export async function drawPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle?: string
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const logo = await loadAppLogo();

  if (logo) {
    const logoWidth = 26;
    const logoHeight = logoWidth / (logo.width / logo.height);
    doc.addImage(logo.source, "PNG", margin, 12, logoWidth, logoHeight, LOGO_ALIAS);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PDF_NAVY);
  doc.text(title, pageWidth - margin, 19, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(subtitle || `Generated on ${formatGeneratedAt()}`, pageWidth - margin, 25, {
    align: "right",
  });

  doc.setDrawColor(...PDF_NAVY);
  doc.setLineWidth(0.6);
  doc.line(margin, 30, pageWidth - margin, 30);

  return 38;
}

/** Draws the shared bottom rule + timestamp + "Powered by Vote+" footer on every page. */
export function drawPdfFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_GRID);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated on ${formatGeneratedAt()}`, margin, pageHeight - 11);

    doc.setTextColor(...PDF_RED);
    doc.setFont("helvetica", "bold");
    doc.text("Powered by Vote+", pageWidth - margin, pageHeight - 11, { align: "right" });

    if (pageCount > 1) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 11, { align: "center" });
    }
  }
}

/** Shared autoTable look: navy header, subtle zebra striping, clean grid. */
export const brandedTableTheme: Partial<UserOptions> = {
  theme: "grid",
  margin: { left: 14, right: 14, bottom: 22 },
  headStyles: {
    fillColor: PDF_NAVY,
    textColor: 255,
    fontStyle: "bold",
    halign: "left",
  },
  alternateRowStyles: { fillColor: [244, 246, 251] },
  styles: {
    lineColor: PDF_GRID,
    lineWidth: 0.15,
    fontSize: 9.5,
    cellPadding: 3,
    valign: "middle",
    overflow: "linebreak",
  },
};
