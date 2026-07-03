import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiRequest } from "@/lib/queryClient";
import { getElectionLabel } from "@/lib/electionHelpers";
import type { Election } from "@/lib/types";
import { getDisplayUsername } from "@/lib/voterPrefix";
import { savePdfBlob, saveXlsxBlob, type SaveDownloadResult } from "@/lib/saveDownload";

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
  return Array.isArray(json.data) ? json.data : [];
}

export async function exportGroupsListToPdf(
  groups: VoterGroupExportRow[],
  title = "Voter Groups"
): Promise<SaveDownloadResult> {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

  autoTable(doc, {
    startY: 38,
    head: [["Name", "Description", "Voters", "Elections"]],
    body: groups.map((g) => [
      g.name || "Untitled",
      g.description || "",
      String(g.voters?.length ?? 0),
      String(g.electionIds?.length ?? 0),
    ]),
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
  });

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
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
  doc.text(`${voters.length} voter(s)`, 14, 37);

  autoTable(doc, {
    startY: 44,
    head: [["Username", "Password", "Status", "Elections"]],
    body: voters.map((v) => [
      getDisplayUsername(v),
      v.plainPassword || "Not available",
      v.status || "active",
      electionNamesForVoter(v, elections),
    ]),
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
  });

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
  XLSX.utils.book_append_sheet(workbook, worksheet, "Voters");
  const filename = `${safeFileName(groupName || "group")}_voters_${fileDateSuffix()}.xlsx`;
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return saveXlsxBlob(blob, filename);
}
