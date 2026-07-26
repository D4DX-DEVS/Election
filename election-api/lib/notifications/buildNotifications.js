const elections = require("../elections");
const votes = require("../supabase/votes");
const users = require("../supabase/users");
const nominees = require("../supabase/nominees");
const auditLogs = require("../supabase/auditLogs");
const { sameFranchise } = require("../roles");
const { resourceFranchiseId } = require("../tenantScope");

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

function makeNotification({ id, type, title, message, href, priority = "medium", createdAt }) {
  return {
    id,
    type,
    title,
    message,
    href: href || null,
    priority,
    createdAt: createdAt || new Date().toISOString(),
  };
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function hoursUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;
  return (target - Date.now()) / MS_HOUR;
}

function hoursSince(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;
  return (Date.now() - target) / MS_HOUR;
}

async function getScopedElections(user) {
  const role = user.role;
  const franchiseId = user.franchiseId;

  if (role === "election_admin") {
    const access = (user.electionAccess || []).map(String).filter(Boolean);
    if (!access.length) return [];
    return elections.findLean({ ids: access });
  }

  if (role === "franchise_admin" && franchiseId) {
    return elections.findLean({ franchiseId });
  }

  return elections.findLean({});
}

async function buildAdminNotifications(user) {
  const items = [];
  const electionList = await getScopedElections(user);
  const now = Date.now();

  for (const election of electionList) {
    const id = String(election._id || election.id);
    const title = election.title || election.organization || "Untitled election";
    const href = `/elections/${id}`;

    if (election.status === "draft" || (!election.votingOpen && election.status !== "completed")) {
      items.push(
        makeNotification({
          id: `draft-${id}`,
          type: "draft_election",
          title: "Election needs setup",
          message: `"${title}" is still in draft. Review nominees and open voting when ready.`,
          href,
          priority: "medium",
          createdAt: election.createdAt,
        })
      );
    }

    if (election.votingOpen && (election.status === "active" || !election.status)) {
      items.push(
        makeNotification({
          id: `voting-open-${id}`,
          type: "voting_open",
          title: "Voting is live",
          message: `"${title}" is open for voting.`,
          href,
          priority: "high",
          createdAt: election.createdAt,
        })
      );
    }

    const until = hoursUntil(election.electionDate);
    if (until !== null && until > 0 && until <= 72) {
      items.push(
        makeNotification({
          id: `election-soon-${id}`,
          type: "election_soon",
          title: "Election date approaching",
          message: `"${title}" is scheduled for ${formatDateLabel(election.electionDate)} (${Math.ceil(until / 24)} day(s) away).`,
          href,
          priority: until <= 24 ? "high" : "medium",
          createdAt: election.electionDate,
        })
      );
    }

    if (election.votingOpen && until !== null && until < 0) {
      items.push(
        makeNotification({
          id: `election-overdue-${id}`,
          type: "election_overdue",
          title: "Election date has passed",
          message: `"${title}" election date was ${formatDateLabel(election.electionDate)} but voting is still open. Consider closing the election.`,
          href,
          priority: "high",
          createdAt: election.electionDate,
        })
      );
    }

    if (election.resultsPublished) {
      const since = hoursSince(election.resultsPublishedAt || election.electionDate);
      if (since !== null && since <= 7 * 24) {
        items.push(
          makeNotification({
            id: `results-${id}`,
            type: "results_published",
            title: "Results published",
            message: `Results for "${title}" are now available.`,
            href: `/results/${id}`,
            priority: "medium",
            createdAt: election.resultsPublishedAt || election.electionDate,
          })
        );
      }
    }

    if (election.votingOpen) {
      const nomineeCount = await nominees.countDocuments({ electionId: id });
      if (nomineeCount === 0) {
        items.push(
          makeNotification({
            id: `no-nominees-${id}`,
            type: "missing_nominees",
            title: "No nominees added",
            message: `"${title}" has voting open but no nominees. Add nominees before voters can cast ballots.`,
            href: `/nominees?electionId=${id}`,
            priority: "high",
            createdAt: election.createdAt,
          })
        );
      }

      const assignedVoterIds = await users.getAssignedVoterIdsForElection(id);
      const eligible = assignedVoterIds.length;
      if (eligible >= 5) {
        const votesCast = await votes.countDocuments({ electionId: id });
        const turnout = Math.round((votesCast / eligible) * 100);
        if (turnout < 15) {
          items.push(
            makeNotification({
              id: `low-turnout-${id}`,
              type: "low_turnout",
              title: "Low voter turnout",
              message: `"${title}" has ${turnout}% turnout (${votesCast}/${eligible} voters). Consider sending reminders.`,
              href,
              priority: "medium",
              createdAt: new Date(now - MS_HOUR).toISOString(),
            })
          );
        }
      }
    }
  }

  if (user.role === "super_admin") {
    const recentLogs = await auditLogs.findRecent({ limit: 15, sinceHours: 48 });
    let relevant = 0;
    for (const log of recentLogs) {
      if (relevant >= 5) break;
      // Skip auth noise (login/logout) — not actionable notifications.
      const action = String(log.action || "").toLowerCase();
      if (
        log.entityType === "Auth" ||
        action.includes("logged in") ||
        action.includes("logged out") ||
        action.includes("login") ||
        action.includes("logout")
      ) {
        continue;
      }
      relevant += 1;
      const actor =
        typeof log.userId === "object"
          ? log.userId.fullName || log.userId.username
          : "A user";
      const entity = log.details?.entity || log.entityType || "item";
      items.push(
        makeNotification({
          id: `audit-${log._id || log.id}`,
          type: "recent_activity",
          title: `${log.action || "Activity"} on ${log.entityType || "system"}`,
          message: `${actor} ${String(log.action || "updated").toLowerCase()} ${entity}.`,
          href: "/audit-logs",
          priority: "low",
          createdAt: log.timestamp,
        })
      );
    }
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    const pr = (priorityRank[a.priority] || 2) - (priorityRank[b.priority] || 2);
    if (pr !== 0) return pr;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return items.slice(0, 30);
}

async function buildVoterNotifications(user) {
  const items = [];
  const access = (user.electionAccess || []).map(String).filter(Boolean);
  if (!access.length) return items;

  const assignedElections = await elections.findByIdsWithFranchise(access, {
    votingOpen: true,
  });
  const electionList = assignedElections.filter((election) =>
    sameFranchise(user.franchiseId, resourceFranchiseId(election))
  );

  for (const election of electionList) {
    const id = String(election._id || election.id);
    const title = election.title || election.organization || "Election";
    const hasVoted = await votes.findOne({
      voterId: user._id || user.id,
      electionId: id,
    });

    if (!hasVoted) {
      items.push(
        makeNotification({
          id: `vote-now-${id}`,
          type: "vote_reminder",
          title: "Your vote is waiting",
          message: `"${title}" is open. Cast your ballot before voting closes.`,
          href: `/election/${id}`,
          priority: "high",
          createdAt: election.electionDate || election.createdAt,
        })
      );
    }

    if (election.resultsPublished) {
      items.push(
        makeNotification({
          id: `voter-results-${id}`,
          type: "results_published",
          title: "Results are in",
          message: `Results for "${title}" have been published.`,
          href: `/results/${id}`,
          priority: "medium",
          createdAt: election.resultsPublishedAt || election.electionDate,
        })
      );
    }
  }

  return items.slice(0, 15);
}

async function buildNotificationsForUser(user) {
  if (!user?.role) return [];
  if (user.role === "voter") return buildVoterNotifications(user);
  return buildAdminNotifications(user);
}

module.exports = {
  buildNotificationsForUser,
};
