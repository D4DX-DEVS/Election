const router = require("express").Router();
const { addElection, getElections, getElectionById, updateElectionById, deleteElectionById, publishResults, setManualWinners } = require("../controllers/election");
const { protect, authorize } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { uploadToCdn } = require("../middleware/uploadImage");

const admin = authorize("super_admin", "franchise_admin", "election_admin");
const franchiseOrSuper = authorize("super_admin", "franchise_admin");

router
  .route("/")
  .post(protect, franchiseOrSuper, upload.single("logo"), uploadToCdn("elections"), addElection)
  .get(protect, admin, getElections);

router.patch("/:id/publish", protect, admin, publishResults);
router.patch("/:id/manual-winners", protect, admin, setManualWinners);

// GET /:id stays voter-accessible — the ballot and results pages need it.
router
  .route("/:id")
  .get(protect, getElectionById)
  .put(protect, admin, upload.single("logo"), uploadToCdn("elections"), updateElectionById)
  .delete(protect, admin, deleteElectionById);

module.exports = router;
