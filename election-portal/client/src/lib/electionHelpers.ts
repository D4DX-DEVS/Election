export type ElectionStatus = "draft" | "active" | "completed" | "archived" | string;

/** Completed (or archived) elections cannot be edited or deleted. */
export function isElectionLocked(status?: ElectionStatus | null): boolean {
  return status === "completed" || status === "archived";
}

export function isElectionEditable(status?: ElectionStatus | null): boolean {
  return !isElectionLocked(status);
}

/**
 * Statuses an election may still be moved to. Completing an election is final —
 * it can never be reopened for voting, only archived to retire the record.
 * Archived elections are frozen entirely. Mirrors the backend guard in
 * controllers/election.js, so the UI never offers an action that would 403.
 */
export function allowedStatusChanges(
  status?: ElectionStatus | null
): Array<"draft" | "active" | "completed" | "archived"> {
  // Archived is reversible, but only back to completed — restoring the record
  // without reopening voting (completed elections are never reopened).
  if (status === "archived") return ["completed"];
  if (status === "completed") return ["archived"];
  const all = ["draft", "active", "completed", "archived"] as const;
  return all.filter((s) => s !== status);
}

/** Primary display label for an election (organization only; title is legacy). */
export function getElectionLabel(election: {
  organization?: string | null;
  title?: string | null;
}): string {
  return (election.organization || election.title || "Untitled").trim();
}

/** Secondary line when label differs from organization (e.g. legacy title). */
export function getElectionSubtitle(election: {
  organization?: string | null;
  title?: string | null;
}): string | null {
  const label = getElectionLabel(election);
  const title = (election.title || "").trim();
  if (title && title !== label) return title;
  return null;
}

export function toFormBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") return false;
  }
  if (value == null) return fallback;
  return Boolean(value);
}

function pickField(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function pickBoolean(source: Record<string, unknown>, ...keys: string[]): boolean {
  const value = pickField(source, ...keys);
  return value === undefined ? false : toFormBoolean(value);
}

function toDateInputValue(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  const str = String(value).trim();
  if (!str) return "";
  if (str.includes("T")) return str.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return str.slice(0, 10);
}

function resolveFranchiseId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "object" && value !== null && "_id" in value) {
    const id = (value as { _id?: string; id?: string })._id || (value as { id?: string }).id;
    return id ? String(id) : undefined;
  }
  const id = String(value).trim();
  return id || undefined;
}

/** Map API election records into react-hook-form defaults. */
export function resolveElectionFormDefaults(initialValues?: Record<string, unknown> | null) {
  if (!initialValues) {
    return {
      organization: "",
      electionDate: new Date().toISOString().split("T")[0],
      endDate: "",
      numberToBeElected: 1,
      ballotSelectionRule: "exact" as const,
      nomineeDisplayOrder: "ALPHA",
      voterResultDisplay: "none",
      resultGenerationMode: "manual" as const,
      maxVoters: 0,
      genderBasedSelection: false,
      maleMinimum: 0,
      femaleMinimum: 0,
      selfRegOpen: false,
      votingOpen: false,
      adminVotingDetailsEnabled: false,
      allowRevote: false,
      manualWinnerSelection: false,
      franchiseId: undefined as string | undefined,
    };
  }

  const src = initialValues as Record<string, unknown>;
  const status = String(src.status || "").toLowerCase();
  const votingOpenRaw = pickField(src, "votingOpen", "voting_open");
  const votingOpen =
    votingOpenRaw !== undefined
      ? toFormBoolean(votingOpenRaw)
      : status === "active";

  return {
    organization: String(src.organization || src.title || "").trim(),
    electionDate:
      toDateInputValue(
        pickField(src, "electionDate", "election_date", "date")
      ) || new Date().toISOString().split("T")[0],
    endDate: toDateInputValue(pickField(src, "endDate", "end_date")) || "",
    numberToBeElected:
      Number(pickField(src, "numberToBeElected", "number_to_be_elected", "maxNominees", "max_nominees") ?? 1) || 1,
    ballotSelectionRule: (
      pickField(src, "ballotSelectionRule", "ballot_selection_rule") === "up_to"
        ? "up_to"
        : "exact"
    ) as "exact" | "up_to",
    nomineeDisplayOrder: String(pickField(src, "nomineeDisplayOrder", "nominee_display_order") || "ALPHA"),
    voterResultDisplay: String(pickField(src, "voterResultDisplay", "voter_result_display") || "full"),
    resultGenerationMode: (
      pickField(src, "resultGenerationMode", "result_generation_mode") === "auto" ? "auto" : "manual"
    ) as "auto" | "manual",
    maxVoters: Number(pickField(src, "maxVoters", "max_voters") ?? 0) || 0,
    genderBasedSelection: pickBoolean(src, "genderBasedSelection", "gender_based_selection"),
    maleMinimum: Number(pickField(src, "maleMinimum", "male_minimum") ?? 0) || 0,
    femaleMinimum: Number(pickField(src, "femaleMinimum", "female_minimum") ?? 0) || 0,
    selfRegOpen: pickBoolean(src, "selfRegOpen", "self_reg_open"),
    votingOpen,
    adminVotingDetailsEnabled: pickBoolean(
      src,
      "adminVotingDetailsEnabled",
      "admin_voting_details_enabled"
    ),
    allowRevote: pickBoolean(src, "allowRevote", "allow_revote"),
    manualWinnerSelection: pickBoolean(
      src,
      "manualWinnerSelection",
      "manual_winner_selection"
    ),
    franchiseId: resolveFranchiseId(src.franchiseId ?? src.franchise_id),
  };
}

/** True when the election date has ended (after 23:59:59 on that day). */
export function isElectionDatePassed(electionDate?: string | null): boolean {
  if (!electionDate) return false;
  const datePart = electionDate.includes("T")
    ? electionDate.split("T")[0]
    : electionDate.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return false;
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  return Date.now() > endOfDay.getTime();
}

/** Apply status rules before sending create/update payloads. */
export function applyElectionLifecycleRules(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...payload };
  const currentStatus = result.status as string | undefined;

  if (currentStatus === "archived") {
    return result;
  }

  const electionDate = String(result.electionDate || "");

  if (isElectionDatePassed(electionDate)) {
    result.status = "completed";
    result.votingOpen = false;
    return result;
  }

  if (result.votingOpen === true || result.votingOpen === "true") {
    result.status = "active";
    result.votingOpen = true;
    return result;
  }

  if (result.votingOpen === false || result.votingOpen === "false") {
    result.votingOpen = false;
    if (currentStatus === "active" || !currentStatus) {
      result.status = "draft";
    }
    return result;
  }

  if (!result.status) {
    result.status = "draft";
  }

  return result;
}

/** Normalize form values into a consistent API payload (create + update). */
export function buildElectionSubmitPayload(formData: Record<string, unknown>) {
  const { logoFile, file, ...rest } = formData;
  const payload = {
    ...rest,
    title: String(rest.organization || rest.title || "").trim(),
    maxNominees: rest.numberToBeElected,
    genderBasedSelection: toFormBoolean(rest.genderBasedSelection),
    selfRegOpen: toFormBoolean(rest.selfRegOpen),
    votingOpen: toFormBoolean(rest.votingOpen),
    adminVotingDetailsEnabled: toFormBoolean(rest.adminVotingDetailsEnabled),
    allowRevote: toFormBoolean(rest.allowRevote),
    manualWinnerSelection: toFormBoolean(rest.manualWinnerSelection),
  };
  const logo =
    logoFile instanceof File
      ? logoFile
      : file instanceof File
        ? file
        : null;
  return { payload, logoFile: logo };
}
