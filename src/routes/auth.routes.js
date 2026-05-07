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
  impersonate,
  updatePassword
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkAnyPermission, checkPermission, checkRole } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/impersonate", authMiddleware, checkRole(["superadmin"]), impersonate);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]), updateProfile);
router.put("/update-password", authMiddleware, updatePassword);

// RBAC Routes
router.get("/users", authMiddleware, checkAnyPermission(["manage_users", "manage_permissions"]), getAllUsers);
router.post("/users", authMiddleware, checkPermission("manage_users"), upload.single("profilePhoto"), createUser);
router.post("/users/batch", authMiddleware, checkPermission("manage_permissions"), batchUpdateUsers);
router.put("/users/:userId/rbac", authMiddleware, checkPermission("manage_users"), upload.single("profilePhoto"), updateUserRBAC);
router.delete("/users/:userId", authMiddleware, checkPermission("manage_users"), deleteUser);

// Permission CRUD
router.get("/permissions", authMiddleware, checkAnyPermission(["manage_permissions", "manage_roles"]), getAllPermissions);
router.post("/permissions", authMiddleware, checkPermission("manage_permissions"), createPermission);
router.put("/permissions/:permissionId", authMiddleware, checkPermission("manage_permissions"), updatePermission);
router.delete("/permissions/:permissionId", authMiddleware, checkPermission("manage_permissions"), deletePermission);

// Role CRUD
router.get("/roles", authMiddleware, checkAnyPermission(["manage_roles", "manage_permissions"]), getAllRoles);
router.post("/roles", authMiddleware, checkPermission("manage_roles"), createRole);
router.put("/roles/:roleId", authMiddleware, checkPermission("manage_roles"), updateRole);
router.delete("/roles/:roleId", authMiddleware, checkPermission("manage_roles"), deleteRole);

export default router;
