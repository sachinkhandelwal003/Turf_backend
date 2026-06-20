import express from "express";
import passport from "../config/passport.js";
import jwt from "jsonwebtoken";
import { 
  register, 
  login, 
  logout,
  getProfile, 
  updateProfile,
  getAdminAccounts,
  resetUserPassword,
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
  deleteOwnAccount,
  sendDeleteAccountOTP,
  verifyDeleteAccountOTP,
  impersonate,
  updatePassword,
  forgotPassword,
  resetPassword,
  googleLogin,
  appleLogin,
  verifyEmail,
  updateFCM
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkAnyPermission, checkPermission, checkRole } from "../middleware/rbac.middleware.js";
import { upload, processAndUploadImages } from "../middleware/upload.middleware.js";
import { sendPushAndSave } from "../utils/firebase.js";
import User from "../models/auth/user.model.js";

const router = express.Router();

// Apple OAuth Redirect & Callback Routes
router.get("/apple", passport.authenticate('apple', {
  scope: ['name', 'email'],
  session: false
}));

router.post("/apple/callback", passport.authenticate('apple', { failureRedirect: '/login', session: false }), async (req, res) => {
  try {
    // Generate JWT Token
    const token = jwt.sign(
      { id: req.user._id, role: req.user.role, permissions: req.user.permissions || [] },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Check if user is new
    const isNewUser = req.user.createdAt > new Date(Date.now() - 5000);

    // Send push notification if user has fcmToken
    if (req.user.fcmToken) {
      const notificationTitle = isNewUser 
        ? "Welcome to GameOn India 🎉" 
        : "New Login Detected 🔐";
      const notificationBody = isNewUser 
        ? `Hi ${req.user.name}! Thanks for signing up with Apple. Start booking turfs and joining matches now!` 
        : `Hi ${req.user.name}! Your account was just logged into with Apple.`;
      
      sendPushAndSave(req.user._id, req.user.fcmToken, notificationTitle, notificationBody, isNewUser ? "welcome" : "login_alert").catch(err => console.error("Apple login notification error:", err));
    }

    const userResponse = req.user.toObject();
    delete userResponse.password;

    // Redirect to frontend with token and user data (or send JSON)
    // For a web app, you might want to redirect with query params or set cookies
    // Here we'll send JSON for API use
    res.json({
      success: true,
      msg: "Login successful",
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Apple callback error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
});

router.post("/register", register);
router.post("/login", login);
router.post("/google-login", googleLogin);
router.post("/apple-login", appleLogin);
router.post("/verify-email", verifyEmail);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/impersonate", authMiddleware, checkRole(["superadmin"]), impersonate);
router.get("/profile", authMiddleware, getProfile);
router.get("/admin-accounts", authMiddleware, checkRole(["superadmin"]), getAdminAccounts);
router.post("/reset-password-admin", authMiddleware, checkRole(["superadmin"]), resetUserPassword);
router.put("/profile", authMiddleware, upload.any(), processAndUploadImages, updateProfile);
router.put("/update-password", authMiddleware, updatePassword);
router.post("/update-fcm", authMiddleware, updateFCM);
// User self-delete account
router.delete("/account", authMiddleware, deleteOwnAccount);

// Public delete account endpoints
router.post("/delete-account/send-otp", sendDeleteAccountOTP);
router.post("/delete-account/verify-otp", verifyDeleteAccountOTP);

// RBAC Routes
router.get("/users", authMiddleware, checkAnyPermission(["manage_users", "manage_permissions"]), getAllUsers);
router.post("/users", authMiddleware, checkPermission("manage_users"), upload.any(), processAndUploadImages, createUser);
router.post("/users/batch", authMiddleware, checkPermission("manage_permissions"), batchUpdateUsers);
router.put("/users/:userId/rbac", authMiddleware, checkPermission("manage_users"), upload.any(), processAndUploadImages, updateUserRBAC);
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
