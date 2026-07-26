const votes = require("../lib/supabase/votes");
const elections = require("../lib/elections");
const nominees = require("../lib/supabase/nominees");
const users = require("../lib/supabase/users");
const { logUserActivity, logAuditFromReq } = require("../utils/auditLog");
const { denyUnlessCanAccessElection } = require("../lib/electionAccess");
const { sameFranchise } = require("../lib/roles");
const { resourceFranchiseId } = require("../lib/tenantScope");

function computeElectedIds(sortedResults, election) {
  if (election.manualWinnerSelection) {
    const ids = Array.isArray(election.manualWinnerIds) ? election.manualWinnerIds : [];
    return new Set(ids.map(String));
  }

  const seats = Math.max(parseInt(election.numberToBeElected, 10) || 1, 1);
  const elected = new Set();

  if (election.genderBasedSelection) {
    const femaleMin = Math.max(parseInt(election.femaleMinimum, 10) || 0, 0);
    const maleMin = Math.max(parseInt(election.maleMinimum, 10) || 0, 0);
    const females = sortedResults.filter((n) => n.gender === "female");
    const males = sortedResults.filter((n) => n.gender !== "female");
    females.slice(0, Math.min(femaleMin, seats)).forEach((n) => elected.add(String(n._id)));
    males.slice(0, Math.max(Math.min(maleMin, seats - elected.size), 0)).forEach((n) => elected.add(String(n._id)));
  }

  for (const n of sortedResults) {
    if (elected.size >= seats) break;
    elected.add(String(n._id));
  }
  return elected;
}

exports.getElectionVoteDetails = async (req, res) => {
  try {
    const { electionId } = req.params;
    const role = req.user && req.user.role;
    if (!role || role === "voter") {
      return res.status(403).json({ success: false, message: "Not authorized to view voting details." });
    }

    const election = await elections.findById(electionId);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, election)) return;
    if (!election.adminVotingDetailsEnabled) {
      return res.status(403).json({
        success: false,
        message: "Admin voting details are not enabled for this election.",
      });
    }

    const voteList = await votes.findByElection(electionId);
    return res.status(200).json({ success: true, count: voteList.length, data: voteList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getElectionResults = async (req, res) => {
  try {
    const { electionId } = req.params;
    const election = await elections.findById(electionId);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });

    const role = req.user && req.user.role;
    const isVoter = role === "voter";

    if (await denyUnlessCanAccessElection(req, res, election)) return;

    const displayMode = election.voterResultDisplay || "full";
    if (isVoter && !election.resultsPublished) {
      return res.status(403).json({ success: false, message: "Results have not been published yet." });
    }
    if (isVoter && displayMode === "none") {
      return res.status(403).json({ success: false, message: "Results are not shown for this election." });
    }

    const totalBallots = await votes.countDocuments({ electionId });

    const tallyMap = await votes.getTallyForElection(electionId);

    const nomineeList = await nominees.findByElection(electionId);
    const results = nomineeList
      .map((n) => {
        const voteCount = tallyMap[String(n._id)] || 0;
        return {
          _id: n._id,
          id: n._id,
          name: n.name,
          gender: n.gender,
          electionId: n.electionId,
          voteCount,
          percentage: totalBallots > 0 ? (voteCount / totalBallots) * 100 : 0,
        };
      })
      .sort((a, b) => b.voteCount - a.voteCount);

    const electedIds = computeElectedIds(results, election);
    results.forEach((r) => {
      r.isElected = electedIds.has(String(r._id));
    });

    const showScore = !isVoter || displayMode === "score" || displayMode === "full";
    const showPercentage = !isVoter || displayMode === "percentage" || displayMode === "full";
    const visibleResults = results.map((r) => ({
      ...r,
      voteCount: showScore ? r.voteCount : undefined,
      percentage: showPercentage ? r.percentage : undefined,
    }));

    const assignedIds = await users.getAssignedVoterIdsForElection(electionId);
    const eligibleVoters = assignedIds.length;

    return res.status(200).json({
      success: true,
      data: {
        election: {
          _id: election._id,
          title: election.title,
          organization: election.organization,
          numberToBeElected: election.numberToBeElected,
          electionDate: election.electionDate,
          createdAt: election.createdAt,
          resultsPublished: !!election.resultsPublished,
          resultsPublishedAt: election.resultsPublishedAt || null,
          votingOpen: !!election.votingOpen,
          genderBasedSelection: !!election.genderBasedSelection,
          maleMinimum: election.maleMinimum || 0,
          femaleMinimum: election.femaleMinimum || 0,
          voterResultDisplay: displayMode,
          ...(isVoter
            ? {}
            : {
                adminVotingDetailsEnabled: !!election.adminVotingDetailsEnabled,
                manualWinnerSelection: !!election.manualWinnerSelection,
                manualWinnerIds: election.manualWinnerIds || [],
              }),
        },
        totalBallots: isVoter && !showScore ? undefined : totalBallots,
        eligibleVoters,
        turnout: eligibleVoters > 0 ? Math.round((totalBallots / eligibleVoters) * 100) : 0,
        nominees: visibleResults,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.addVote = async (req, res) => {
  try {
    const vote = await votes.create(req.body);
    await logUserActivity(req.user._id, req.ip, "Voted", vote.electionId, "Vote");
    res.status(201).json({ success: true, message: "Vote recorded.", vote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getAvailableElections = async (req, res) => {
  try {
    const voter = await users.findById(req.user._id);
    if (!voter || !voter.electionAccess || voter.electionAccess.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    const assigned = await elections.findByIdsWithFranchise(voter.electionAccess, {
      votingOpen: true,
    });
    const data = assigned.filter((election) =>
      sameFranchise(voter.franchiseId, resourceFranchiseId(election))
    );
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.checkVoterStatus = async (req, res) => {
  try {
    const voteList = await votes.findByVoter(req.user._id);
    const votingStatus = {};
    for (const vote of voteList) {
      const election = await elections.findById(vote.electionId);
      if (
        election &&
        sameFranchise(req.user.franchiseId, resourceFranchiseId(election))
      ) {
        votingStatus[String(vote.electionId)] = "voted";
      }
    }
    res.status(200).json({ success: true, data: votingStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getMyVote = async (req, res) => {
  try {
    const election = await elections.findById(req.params.electionId);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, election)) return;

    const vote = await votes.findOne({
      voterId: req.user._id,
      electionId: req.params.electionId,
    });
    if (!vote) return res.status(404).json({ success: false, message: "No vote found for this election." });
    res.status(200).json({ success: true, data: vote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.castVote = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { nomineeIds } = req.body;

    if (!nomineeIds || !Array.isArray(nomineeIds) || nomineeIds.length === 0) {
      return res.status(400).json({ success: false, message: "nomineeIds array is required." });
    }

    const election = await elections.findById(electionId);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, election)) return;
    if (!election.votingOpen) return res.status(400).json({ success: false, message: "Election is not open for voting." });

    const hasAccess = await users.userHasElectionAccess(req.user._id, electionId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Voter does not have access to this election." });
    }

    const uniqueNomineeIds = [...new Set(nomineeIds.map((id) => String(id)))];
    const selectionLimit = Math.max(parseInt(election.numberToBeElected, 10) || 1, 1);
    const ballotSelectionRule =
      election.ballotSelectionRule === "up_to" ? "up_to" : "exact";
    if (ballotSelectionRule === "exact" && uniqueNomineeIds.length !== selectionLimit) {
      return res.status(400).json({
        success: false,
        message: `Select exactly ${selectionLimit} nominee(s).`,
      });
    }
    if (uniqueNomineeIds.length > selectionLimit) {
      return res.status(400).json({
        success: false,
        message: `Select up to ${selectionLimit} nominee(s).`,
      });
    }

    const selectedNominees = await nominees.findByIdsAndElection(uniqueNomineeIds, electionId);
    if (selectedNominees.length !== uniqueNomineeIds.length) {
      return res.status(400).json({ success: false, message: "One or more selected nominees are invalid for this election." });
    }

    if (election.genderBasedSelection) {
      const maleCount = selectedNominees.filter((n) => n.gender !== "female").length;
      const femaleCount = selectedNominees.filter((n) => n.gender === "female").length;
      if ((election.maleMinimum || 0) > 0 && maleCount < election.maleMinimum) {
        return res.status(400).json({ success: false, message: `Select at least ${election.maleMinimum} male nominee(s).` });
      }
      if ((election.femaleMinimum || 0) > 0 && femaleCount < election.femaleMinimum) {
        return res.status(400).json({ success: false, message: `Select at least ${election.femaleMinimum} female nominee(s).` });
      }
    }

    const existing = await votes.findOne({ voterId: req.user._id, electionId });
    if (existing) return res.status(400).json({ success: false, message: "Already voted in this election." });

    try {
      const vote = await votes.create({
        electionId,
        voterId: req.user._id,
        nominees: uniqueNomineeIds,
        ipAddress: req.ip,
        status: "completed",
      });
      res.status(201).json({ success: true, message: "Vote cast successfully.", data: vote });
    } catch (createErr) {
      if (createErr && createErr.code === 23505) {
        return res.status(400).json({ success: false, message: "Already voted in this election." });
      }
      throw createErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getVotes = async (req, res) => {
  try {
    const data = await votes.findAll();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.updateVote = async (req, res) => {
  try {
    const { id } = req.body;
    const vote = await votes.updateById(id, req.body);
    if (!vote) {
      return res.status(404).json({ success: false, message: "Vote not found." });
    }
    await logAuditFromReq(req, "Updated", vote.electionId || "vote", "Vote", vote._id || vote.id);
    res.status(200).json({ success: true, data: vote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.deleteVote = async (req, res) => {
  try {
    const { id } = req.query;
    const vote = await votes.deleteById(id);
    if (!vote) {
      return res.status(404).json({ success: false, message: "Vote not found." });
    }
    await logAuditFromReq(req, "Deleted", vote.electionId || "vote", "Vote", vote._id || vote.id);
    res.status(200).json({ success: true, message: "Vote deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};
