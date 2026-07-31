const router = require("express").Router();
const {
  addUser, getUsers, updateUser, deleteUser,
  getUserById, getFranchiseAdmins, getElectionAdmins,
  createFranchiseAdmin, createElectionAdmin, resetPassword, getAllVoters,
  generateVoters, createVoter, getVoterCredentials,
} = require("../controllers/user");
const { protect, authorize } = require("../middleware/auth");

const admin = authorize("super_admin", "franchise_admin", "election_admin");
const superAdmin = authorize("super_admin");
const franchiseOrSuper = authorize("super_admin", "franchise_admin");
const franchiseAdminOnly = authorize("franchise_admin");

router.route("/").post(protect, admin, addUser).get(protect, admin, getUsers);
router.get("/franchise-admins", protect, franchiseOrSuper, getFranchiseAdmins);
router.get("/election-admins", protect, franchiseAdminOnly, getElectionAdmins);
router.get("/voters", protect, admin, getAllVoters);
router.post("/voters", protect, admin, createVoter);
router.post("/voters/generate", protect, admin, generateVoters);
router.post("/voters/credentials", protect, admin, getVoterCredentials);
router.delete("/voters/:id", protect, admin, deleteUser);
router.post("/franchise-admin", protect, superAdmin, createFranchiseAdmin);
router.post("/election-admin", protect, franchiseAdminOnly, createElectionAdmin);
router.route("/:id").get(protect, admin, getUserById).put(protect, admin, updateUser).delete(protect, admin, deleteUser);
router.post("/:id/reset-password", protect, admin, resetPassword);

module.exports = router;
