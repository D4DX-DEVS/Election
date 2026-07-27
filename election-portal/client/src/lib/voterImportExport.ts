import * as XLSX from "xlsx";
import { apiRequest } from "@/lib/queryClient";
import type { Election, User } from "@/lib/types";
import { getElectionLabel } from "@/lib/electionHelpers";
import { autoSizeColumns } from "@/lib/excelHelpers";

export type VoterRow = User & { _id?: string; id?: string; electionAccess?: string[] };

export type ParsedVoterImportRow = {
  username: string;
  fullName: string;
  password: string;
  registrationNumber: string;
  electionIds: string[];
  rowNumber: number;
};

export type VoterImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

function getRecordId(record: { _id?: string; id?: string }) {
  return record._id?.toString() || record.id?.toString() || "";
}

function normalizeHeader(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function pickField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function resolveElectionIds(
  raw: string,
  elections: Election[]
): string[] {
  if (!raw.trim()) return [];
  const parts = raw.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
  const ids: string[] = [];

  for (const part of parts) {
    const byId = elections.find((e) => getRecordId(e) === part);
    if (byId) {
      ids.push(getRecordId(byId));
      continue;
    }
    const lower = part.toLowerCase();
    const byTitle = elections.find(
      (e) =>
        e.organization?.toLowerCase() === lower ||
        getElectionLabel(e).toLowerCase() === lower
    );
    if (byTitle) ids.push(getRecordId(byTitle));
  }

  return [...new Set(ids.filter(Boolean))];
}

export async function parseVoterImportFile(
  file: File,
  elections: Election[]
): Promise<ParsedVoterImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The file has no worksheets.");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rawRows.length) throw new Error("The file has no data rows.");

  const parsed: ParsedVoterImportRow[] = [];

  rawRows.forEach((row, index) => {
    const normalized: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeHeader(key)] = value;
    });

    const username = pickField(normalized, "username", "user", "login", "voter_id");
    if (!username) return;

    const fullName = pickField(normalized, "full_name", "fullname", "name");
    const password = pickField(normalized, "password", "pass", "pin");
    const registrationNumber = pickField(
      normalized,
      "registration_number",
      "registrationnumber",
      "reg_no",
      "regno",
      "registration"
    );
    const electionRaw = pickField(
      normalized,
      "election_ids",
      "electionids",
      "election_id",
      "election",
      "elections"
    );

    parsed.push({
      username,
      fullName: fullName || username,
      password,
      registrationNumber: registrationNumber || username,
      electionIds: resolveElectionIds(electionRaw, elections),
      rowNumber: index + 2,
    });
  });

  if (!parsed.length) {
    throw new Error("No valid rows found. Include a column named username.");
  }

  return parsed;
}

export async function importVotersFromRows(
  rows: ParsedVoterImportRow[],
  defaultElectionIds: string[] = []
): Promise<VoterImportResult> {
  const result: VoterImportResult = { created: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      const res = await apiRequest("POST", "/api/users/voters", {
        username: row.username,
        fullName: row.fullName,
        password: row.password || undefined,
        registrationNumber: row.registrationNumber,
        electionIds: row.electionIds.length ? row.electionIds : defaultElectionIds,
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          result.skipped += 1;
          result.errors.push(`Row ${row.rowNumber}: username "${row.username}" already exists.`);
          continue;
        }
        throw new Error(body.message || res.statusText);
      }

      result.created += 1;
    } catch (err) {
      result.errors.push(
        `Row ${row.rowNumber}: ${err instanceof Error ? err.message : "Import failed"}`
      );
    }
  }

  return result;
}

/** Client-side voter search (username, full name, registration #). */
export function filterVotersBySearch<T extends {
  username?: string;
  fullName?: string;
  registrationNumber?: string;
}>(voters: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return voters;
  return voters.filter((v) => {
    const fields = [v.username, v.fullName, v.registrationNumber].map((f) =>
      (f || "").toLowerCase()
    );
    return fields.some((f) => f.includes(q));
  });
}

export async function fetchAllVoters(params: {
  electionId?: string;
  search?: string;
}): Promise<VoterRow[]> {
  const pageSize = 500;
  let page = 1;
  let total = Infinity;
  const all: VoterRow[] = [];

  while (all.length < total) {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (params.electionId && params.electionId !== "all") {
      qs.set("electionId", params.electionId);
    }
    if (params.search?.trim()) {
      qs.set("search", params.search.trim());
    }

    const res = await apiRequest("GET", `/api/users/voters?${qs.toString()}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || "Failed to fetch voters");

    const batch: VoterRow[] = body.data || [];
    total = body.pagination?.total ?? batch.length;
    all.push(...batch);
    if (batch.length < pageSize) break;
    page += 1;
  }

  return all;
}

export function exportVotersToExcel(
  voters: VoterRow[],
  elections: Election[],
  options: { electionFilterLabel?: string } = {}
) {
  const electionMap = new Map(
    elections.map((e) => [getRecordId(e), getElectionLabel(e)])
  );

  const excelData = voters.map((voter) => {
    const ids = (voter.electionAccess || []).map(String);
    const electionNames = ids
      .map((id) => electionMap.get(id) || id)
      .filter(Boolean)
      .join("; ");

    return {
      Username: voter.username || "",
      "Full Name": voter.fullName || "",
      "Registration Number": voter.registrationNumber || "",
      Status: voter.status || "active",
      Elections: electionNames,
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  worksheet["!cols"] = autoSizeColumns(excelData);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Voters");

  const label = options.electionFilterLabel || "All_Voters";
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${label.replace(/\s+/g, "_")}_${date}.xlsx`);
}

export function downloadVoterImportTemplate() {
  const rows = [
    {
      username: "voter001",
      full_name: "John Doe",
      password: "optional",
      registration_number: "voter001",
      elections: "Board Election - Acme Corp",
    },
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = autoSizeColumns(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "voter_import_template.xlsx");
}
