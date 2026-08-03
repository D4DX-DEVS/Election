const router = require("express").Router();
const { castVote, checkVoterStatus, getAvailableElections, getMyVote, getElectionResults, getElectionVoteDetails, resetVoterVote } = require("../controllers/vote");
const { protect, authorize } = require("../middleware/auth");

const admin = authorize("super_admin", "franchise_admin", "election_admin");
const voter = authorize("voter");

router.get("/available-elections", protect, voter, getAvailableElections);
router.get("/voter-status", protect, voter, checkVoterStatus);
router.get("/results/:electionId", protect, getElectionResults);
router.get("/details/:electionId", protect, admin, getElectionVoteDetails);
router.get("/my-vote/:electionId", protect, voter, getMyVote);
router.post("/cast/:electionId", protect, voter, castVote);
router.delete("/:electionId/voter/:voterId", protect, admin, resetVoterVote);

module.exports = router;
