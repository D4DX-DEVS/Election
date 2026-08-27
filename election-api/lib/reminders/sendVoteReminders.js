const { getSupabase } = require("../../config/supabase");
const elections = require("../elections");
const users = require("../supabase/users");
const votes = require("../supabase/votes");
const { isEmailConfigured, sendMail } = require("../email");

function getPortalBaseUrl() {
  const fromEnv = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((u) => u.trim().replace(/\/$/, ""))
    .filter(Boolean)[0];
  if (!fromEnv) {
    throw new Error("FRONTEND_URL is required for reminder links.");
  }
  return fromEnv;
}

async function fetchUsersByIds(ids) {
  if (!ids.length) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, email, full_name, status")
    .in("id", ids);
  if (error) throw error;
  return data || [];
}

async function sendVoteReminders(electionId) {
  const election = await elections.findById(electionId);
  if (!election) {
    const err = new Error("Election not found.");
    err.statusCode = 404;
    throw err;
  }

  if (!election.votingOpen) {
    const err = new Error("Voting is not open for this election.");
    err.statusCode = 400;
    throw err;
  }

  const assignedIds = await users.getAssignedVoterIdsForElection(electionId);
  if (!assignedIds.length) {
    return {
      pendingCount: 0,
      emailsSent: 0,
      skippedNoEmail: 0,
      smtpConfigured: isEmailConfigured(),
      message: "No voters are assigned to this election.",
    };
  }

  const supabase = getSupabase();
  const { data: votedRows, error: voteErr } = await supabase
    .from("votes")
    .select("voter_id")
    .eq("election_id", electionId);
  if (voteErr) throw voteErr;

  const votedSet = new Set((votedRows || []).map((r) => String(r.voter_id)));
  const pendingIds = assignedIds.filter((id) => !votedSet.has(String(id)));

  if (!pendingIds.length) {
    return {
      pendingCount: 0,
      emailsSent: 0,
      skippedNoEmail: 0,
      smtpConfigured: isEmailConfigured(),
      message: "All assigned voters have already voted.",
    };
  }

  const pendingUsers = await fetchUsersByIds(pendingIds);
  const portalUrl = getPortalBaseUrl();
  const electionLabel = `${election.title} — ${election.organization || "Election"}`;

  let emailsSent = 0;
  let skippedNoEmail = 0;

  for (const user of pendingUsers) {
    if (user.status === "inactive") continue;
    const email = user.email && String(user.email).trim();
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }

    const displayName = user.full_name || user.username;
    const subject = `Reminder: Please vote in ${election.title}`;
    const text = [
      `Hello ${displayName},`,
      "",
      `This is a reminder to cast your vote in "${electionLabel}".`,
      "",
      `Log in at ${portalUrl}/login and open the voting portal to submit your ballot.`,
      "",
      "Thank you.",
    ].join("\n");

    const html = `
      <p>Hello ${displayName},</p>
      <p>This is a reminder to cast your vote in <strong>${electionLabel}</strong>.</p>
      <p><a href="${portalUrl}/login">Log in to Vote+</a> and open the voting portal to submit your ballot.</p>
      <p>Thank you.</p>
    `;

    const result = await sendMail({ to: email, subject, text, html });
    if (result.sent) emailsSent += 1;
    else skippedNoEmail += 1;
  }

  const smtpConfigured = isEmailConfigured();
  let message;
  if (!smtpConfigured) {
    message = `${pendingIds.length} voter(s) have not voted. Configure SMTP in election-api to send email reminders.`;
  } else if (emailsSent === 0) {
    message = `${pendingIds.length} pending voter(s), but none had an email address on file.`;
  } else {
    message = `Sent ${emailsSent} reminder email(s) to voters who have not voted yet.`;
  }

  return {
    pendingCount: pendingIds.length,
    emailsSent,
    skippedNoEmail,
    smtpConfigured,
    message,
  };
}

module.exports = { sendVoteReminders };
