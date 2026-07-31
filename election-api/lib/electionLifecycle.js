/**
 * Election status rules:
 * - Election date ended → status completed, voting closed
 * - Open voting enabled → status active (if date not ended)
 * - Voting closed → status draft (unless archived/completed by date)
 */

function parseElectionDate(value) {
  if (!value) return null;
  const str = String(value);
  const datePart = str.includes("T") ? str.split("T")[0] : str.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(year, month - 1, day);
}

function isElectionDatePassed(electionDate, endDate) {
  const date = parseElectionDate(endDate || electionDate);
  if (!date) return false;
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return Date.now() > endOfDay.getTime();
}

/**
 * Mutates/returns patch object with status + votingOpen based on date and votingOpen flag.
 */
function applyElectionLifecycleRules(patch, existing = {}) {
  applyStatusRules(patch, existing);

  // Results generation: when an election transitions into "completed" and the
  // election's resultGenerationMode is "auto", publish results immediately
  // instead of requiring the admin to hit the manual publish action.
  const resultGenerationMode =
    patch.resultGenerationMode !== undefined
      ? patch.resultGenerationMode
      : existing.resultGenerationMode;
  const becameCompleted = patch.status === "completed" && existing.status !== "completed";
  if (becameCompleted && resultGenerationMode === "auto" && !existing.resultsPublished) {
    patch.resultsPublished = true;
    patch.resultsPublishedAt = new Date().toISOString();
  }

  return patch;
}

function applyStatusRules(patch, existing = {}) {
  const electionDate =
    patch.electionDate !== undefined ? patch.electionDate : existing.electionDate;
  const endDate = patch.endDate !== undefined ? patch.endDate : existing.endDate;
  const votingOpen =
    patch.votingOpen !== undefined ? patch.votingOpen : existing.votingOpen;
  const currentStatus = patch.status !== undefined ? patch.status : existing.status;
  const autoCompleteDisabled =
    patch.autoCompleteDisabled !== undefined
      ? patch.autoCompleteDisabled
      : existing.autoCompleteDisabled;

  // A non-empty patch.status means an admin is driving the change; an empty
  // patch means this is a passive sync where only the date rules apply.
  const explicitStatus = existing.status ? patch.status : undefined;

  if (explicitStatus === "completed" || explicitStatus === "archived") {
    patch.votingOpen = false;
    // Back to a terminal state — hand control back to the date-driven rules.
    if (autoCompleteDisabled) patch.autoCompleteDisabled = false;
    return patch;
  }

  if (currentStatus === "archived") {
    return patch;
  }

  // Reopening or pausing an election is an explicit admin decision and always
  // wins over the date rules below. For an election whose date has already
  // passed, that also means flagging it as manually controlled — otherwise the
  // next read would auto-complete it and silently undo the change.
  if (explicitStatus === "active" || explicitStatus === "draft") {
    patch.status = explicitStatus;
    patch.votingOpen = explicitStatus === "active";
    if (autoCompleteDisabled || isElectionDatePassed(electionDate, endDate)) {
      patch.autoCompleteDisabled = true;
    }
    return patch;
  }

  // Manual control persists across passive syncs (patch is {} on those calls).
  if (autoCompleteDisabled && (currentStatus === "active" || currentStatus === "draft")) {
    patch.status = currentStatus;
    patch.votingOpen = currentStatus === "active";
    return patch;
  }

  if (isElectionDatePassed(electionDate, endDate)) {
    patch.status = "completed";
    patch.votingOpen = false;
    return patch;
  }

  if (votingOpen === true) {
    patch.status = "active";
    patch.votingOpen = true;
    return patch;
  }

  if (patch.votingOpen === false || votingOpen === false) {
    patch.votingOpen = false;
    if (currentStatus === "active" || !currentStatus) {
      patch.status = "draft";
    }
    return patch;
  }

  if (!patch.status && !existing.status) {
    patch.status = "draft";
  }

  return patch;
}

async function syncElectionLifecycle(election, updateFn) {
  if (!election || election.status === "archived" || !updateFn) {
    return election;
  }

  const patch = applyElectionLifecycleRules({}, election);
  const statusChanged = patch.status && patch.status !== election.status;
  const votingChanged =
    patch.votingOpen !== undefined && patch.votingOpen !== election.votingOpen;

  if (!statusChanged && !votingChanged) {
    return election;
  }

  const id = election._id || election.id;
  if (!id) return { ...election, ...patch };

  const updated = await updateFn(id, patch);
  return updated || { ...election, ...patch };
}

module.exports = {
  isElectionDatePassed,
  applyElectionLifecycleRules,
  syncElectionLifecycle,
};
