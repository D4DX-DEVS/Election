const router = require("express").Router();
const { addNominee, bulkAddNominees, getNominees, getNomineeById, getNomineesByElection, updateNomineeById, deleteNomineeById, importPreviousNominees } = require("../controllers/nominee");
const { protect, authorize } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { uploadToCdn } = require("../middleware/uploadImage");

const admin = authorize("super_admin", "franchise_admin", "election_admin");

router.route("/").post(protect, admin, upload.single("photo"), uploadToCdn("nominees"), addNominee).get(protect, admin, getNominees);
router.route("/bulk").post(protect, admin, bulkAddNominees);
router.route("/import-previous").post(protect, admin, importPreviousNominees);
// Voters need the nominee list for the ballot they are voting on.
router.route("/election/:electionId").get(protect, getNomineesByElection);
router
  .route("/:id")
  .get(protect, admin, getNomineeById)
  .put(protect, admin, upload.single("photo"), uploadToCdn("nominees"), updateNomineeById)
  .patch(protect, admin, upload.single("photo"), uploadToCdn("nominees"), updateNomineeById)
  .delete(protect, admin, deleteNomineeById);

module.exports = router;
