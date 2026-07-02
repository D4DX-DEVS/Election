const router = require("express").Router();
const { addFranchise, getFranchises, getFranchiseById, updateFranchiseById, deleteFranchiseById } = require("../controllers/franchise");
const { protect, authorize } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { uploadToCdn } = require("../middleware/uploadImage");

const admin = authorize("super_admin", "franchise_admin", "election_admin");
const superAdmin = authorize("super_admin");
const franchiseOrSuper = authorize("super_admin", "franchise_admin");

router
  .route("/")
  .post(protect, superAdmin, upload.single("logo"), uploadToCdn("franchises"), addFranchise)
  .get(protect, admin, getFranchises);

router
  .route("/:id")
  .get(protect, getFranchiseById)
  .put(protect, franchiseOrSuper, upload.single("logo"), uploadToCdn("franchises"), updateFranchiseById)
  .delete(protect, superAdmin, deleteFranchiseById);

module.exports = router;
