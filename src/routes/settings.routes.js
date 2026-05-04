import express from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.get("/", getSettings);
router.post("/", authMiddleware, checkRole(["superadmin"]), upload.fields([
  { name: "frontendLogo", maxCount: 1 },
  { name: "backendLogo", maxCount: 1 }
]), updateSettings);

export default router;
