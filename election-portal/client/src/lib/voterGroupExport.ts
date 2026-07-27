import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiRequest } from "@/lib/queryClient";
import { getElectionLabel } from "@/lib/electionHelpers";
import type { Election } from "@/lib/types";
import { getDisplayUsername } from "@/lib/voterPrefix";
import { savePdfBlob, saveXlsxBlob, type SaveDownloadResult } from "@/lib/saveDownload";
import { drawPdfHeader, drawPdfFooter, brandedTableTheme } from "@/lib/pdfBranding";
import { autoSizeColumns } from "@/lib/excelHelpers";

export interface VoterGroupExportRow {
  _id: string;
  name?: string;
  description?: string;
  prefix?: string;
  voters?: string[];
  electionIds?: string[];
}

export interface GroupVoterExportRow {
  _id: string;
  username: string;
  status?: string;
  plainPassword?: string;
  fullName?: string;
  registrationNumber?: string;
  electionAccess?: string[];
  voterMetadata?: { prefix?: string; sequenceNumber?: number };
}

function getRecordId(record: { _id?: string; id?: string }) {
  return record._id?.toString() || record.id?.toString() || "";
}

function fileDateSuffix() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(label: string) {
  return label.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_");
}

function electionNamesForVoter(
  voter: GroupVoterExportRow,
  elections: Election[]
): string {
  const electionMap = new Map(
    elections.map((e) => [getRecordId(e), getElectionLabel(e)])
  );
  return (voter.electionAccess || [])
    .map((id) => electionMap.get(String(id)) || String(id))
    .filter(Boolean)
    .join("; ");
}

export async function fetchAllVoterGroups(): Promise<VoterGroupExportRow[]> {
  const res = await apiRequest("GET", "/api/voter-groups?limit=500&page=1");
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchGroupVoters(
  groupId: string
): Promise<GroupVoterExportRow[]> {
  const res = await apiRequest("GET", `/api/voter-groups/${groupId}/voters`);
  const json = await res.json();
  const voters: GroupVoterExportRow[] = Array.isArray(json.data) ? json.data : [];
  if (!voters.length) return voters;

  const voterIds = voters.map((v) => v._id).filter(Boolean);
  const credRes = await apiRequest("POST", "/api/users/voters/credentials", { voterIds });
  const credJson = await credRes.json();
  const passwordById = new Map(
    (Array.isArray(credJson.data) ? credJson.data : []).map((c: { id: string; plainPassword?: string }) => [
      String(c.id),
      c.plainPassword,
    ])
  );
  return voters.map((v) => ({ ...v, plainPassword: passwordById.get(String(v._id)) }));
}

export async function exportGroupsListToPdf(
  groups: VoterGroupExportRow[],
  title = "Voter Groups"
): Promise<SaveDownloadResult> {
  const doc = new jsPDF();
  const startY = await drawPdfHeader(doc, title, `${groups.length} group(s)`);

  autoTable(doc, {
    ...brandedTableTheme,
    startY,
    head: [["Name", "Description", "Voters", "Elections"]],
    body: groups.map((g) => [
      g.name || "Untitled",
      g.description || "—",
      String(g.voters?.length ?? 0),
      String(g.electionIds?.length ?? 0),
    ]),
    columnStyles: {
      2: { halign: "right", cellWidth: 22 },
      3: { halign: "right", cellWidth: 22 },
    },
  });

  drawPdfFooter(doc);
  const filename = `${safeFileName(title)}_${fileDateSuffix()}.pdf`;
  return savePdfBlob(doc.output("blob"), filename);
}

export async function exportGroupsListToExcel(
  groups: VoterGroupExportRow[],
  title = "Voter Groups"
): Promise<SaveDownloadResult> {
  const rows = groups.map((g) => ({
    Name: g.name || "Untitled",
    Description: g.description || "",
    "Voter Count": g.voters?.length ?? 0,
    "Election Count": g.electionIds?.length ?? 0,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = autoSizeColumns(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Groups");
  const filename = `${safeFileName(title)}_${fileDateSuffix()}.xlsx`;
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return saveXlsxBlob(blob, filename);
}

export async function exportGroupVotersToPdf(
  groupName: string,
  voters: GroupVoterExportRow[],
  elections: Election[] = []
): Promise<SaveDownloadResult> {
  const title = `${groupName || "Voter Group"} — Voters`;
  const doc = new jsPDF();
  const startY = await drawPdfHeader(doc, title, `${voters.length} voter(s)`);

  autoTable(doc, {
    ...brandedTableTheme,
    startY,
    head: [["Username", "Password", "Status", "Elections"]],
    body: voters.map((v) => [
      getDisplayUsername(v),
      v.plainPassword || "Not available",
      v.status || "active",
      electionNamesForVoter(v, elections) || "—",
    ]),
    columnStyles: {
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
    },
  });

  drawPdfFooter(doc);
  const filename = `${safeFileName(groupName || "group")}_voters_${fileDateSuffix()}.pdf`;
  return savePdfBlob(doc.output("blob"), filename);
}

export async function exportGroupVotersToExcel(
  groupName: string,
  voters: GroupVoterExportRow[],
  elections: Election[] = []
): Promise<SaveDownloadResult> {
  const rows = voters.map((v) => ({
    Username: getDisplayUsername(v),
    Password: v.plainPassword || "",
    "Full Name": v.fullName || "",
    "Registration Number": v.registrationNumber || "",
    Status: v.status || "active",
    Elections: electionNamesForVoter(v, elections),
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = autoSizeColumns(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Voters");
  const filename = `${safeFileName(groupName || "group")}_voters_${fileDateSuffix()}.xlsx`;
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return saveXlsxBlob(blob, filename);
}
