import express from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission } from "../middleware/rbac.middleware.js";
import { upload, processAndUploadImages } from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/", getSettings);
router.post("/", authMiddleware, checkPermission("manage_settings"), upload.any(), processAndUploadImages, updateSettings);

export default router;
