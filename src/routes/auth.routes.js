import express from "express";
import { 
  register, 
  login, 
  getProfile, 
  updateProfile,
  getAllUsers, 
  updateUserRBAC, 
  batchUpdateUsers,
  getAllPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  createUser,
  deleteUser,
  impersonate
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/impersonate", authMiddleware, checkRole(["superadmin"]), impersonate);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, upload.single("profilePhoto"), updateProfile);

// RBAC Routes
router.get("/users", authMiddleware, checkRole(["admin", "superadmin"]), getAllUsers);
router.post("/users", authMiddleware, checkRole(["admin", "superadmin"]), upload.single("profilePhoto"), createUser);
router.post("/users/batch", authMiddleware, checkRole(["admin", "superadmin"]), batchUpdateUsers);
router.put("/users/:userId/rbac", authMiddleware, checkRole(["admin", "superadmin"]), upload.single("profilePhoto"), updateUserRBAC);
router.delete("/users/:userId", authMiddleware, checkRole(["admin", "superadmin"]), deleteUser);

// Permission CRUD
router.get("/permissions", authMiddleware, checkRole(["superadmin", "admin"]), getAllPermissions);
router.post("/permissions", authMiddleware, checkRole(["superadmin"]), createPermission);
router.put("/permissions/:permissionId", authMiddleware, checkRole(["superadmin"]), updatePermission);
router.delete("/permissions/:permissionId", authMiddleware, checkRole(["superadmin"]), deletePermission);

// Role CRUD
router.get("/roles", authMiddleware, checkRole(["superadmin", "admin"]), getAllRoles);
router.post("/roles", authMiddleware, checkRole(["superadmin"]), createRole);
router.put("/roles/:roleId", authMiddleware, checkRole(["superadmin"]), updateRole);
router.delete("/roles/:roleId", authMiddleware, checkRole(["superadmin"]), deleteRole);

export default router;