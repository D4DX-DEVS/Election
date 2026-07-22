const router = require("express").Router();
const { addVote, getVotes, castVote, checkVoterStatus, getAvailableElections, getMyVote, getElectionResults, getElectionVoteDetails } = require("../controllers/vote");
const { protect, authorize } = require("../middleware/auth");

const admin = authorize("super_admin", "franchise_admin", "election_admin");

router.route("/").post(protect, admin, addVote).get(protect, admin, getVotes);
router.get("/available-elections", protect, getAvailableElections);
router.get("/voter-status", protect, checkVoterStatus);
router.get("/results/:electionId", protect, getElectionResults);
router.get("/details/:electionId", protect, admin, getElectionVoteDetails);
router.get("/my-vote/:electionId", protect, getMyVote);
router.post("/cast/:electionId", protect, castVote);

module.exports = router;
