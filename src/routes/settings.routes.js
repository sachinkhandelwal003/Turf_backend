import express from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.get("/", getSettings);
router.post("/", authMiddleware, checkPermission("manage_settings"), upload.fields([
  { name: "frontendLogo", maxCount: 1 },
  { name: "backendLogo", maxCount: 1 },
  { name: "image", maxCount: 1 }
]), updateSettings);

export default router;
