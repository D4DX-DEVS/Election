/** Boolean election fields stored in Supabase `elections` table. */
const ELECTION_BOOLEAN_KEYS = [
  "selfRegOpen",
  "votingOpen",
  "resultsPublished",
  "genderBasedSelection",
  "adminVotingDetailsEnabled",
  "allowRevote",
  "manualWinnerSelection",
];

function toBodyBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") return false;
  }
  if (value == null) return false;
  return Boolean(value);
}

/** Coerce multipart / JSON boolean fields before create or update. */
function normalizeElectionBody(body) {
  if (!body || typeof body !== "object") return body;
  ELECTION_BOOLEAN_KEYS.forEach((key) => {
    if (body[key] !== undefined) {
      body[key] = toBodyBoolean(body[key]);
    }
  });
  return body;
}

module.exports = {
  ELECTION_BOOLEAN_KEYS,
  toBodyBoolean,
  normalizeElectionBody,
};
