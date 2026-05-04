import express from "express";
import { 
  register, 
  login, 
  getProfile, 
  getAllUsers, 
  updateUserRBAC, 
  getAllPermissions,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  createUser,
  deleteUser
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", authMiddleware, getProfile);

// RBAC Routes
router.get("/users", authMiddleware, checkRole(["admin", "superadmin"]), getAllUsers);
router.post("/users", authMiddleware, checkRole(["superadmin"]), createUser);
router.put("/users/:userId/rbac", authMiddleware, checkRole(["superadmin"]), updateUserRBAC);
router.delete("/users/:userId", authMiddleware, checkRole(["superadmin"]), deleteUser);
router.get("/permissions", authMiddleware, checkRole(["superadmin"]), getAllPermissions);

// Role CRUD
router.get("/roles", authMiddleware, checkRole(["superadmin", "admin"]), getAllRoles);
router.post("/roles", authMiddleware, checkRole(["superadmin"]), createRole);
router.put("/roles/:roleId", authMiddleware, checkRole(["superadmin"]), updateRole);
router.delete("/roles/:roleId", authMiddleware, checkRole(["superadmin"]), deleteRole);

export default router;