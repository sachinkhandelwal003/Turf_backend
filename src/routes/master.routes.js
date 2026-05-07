import express from "express";
import { getMasters, createMaster, deleteMaster, updateMaster } from "../controllers/master.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.get("/", getMasters);
router.post("/", authMiddleware, checkPermission("manage_masters"), upload.single("image"), createMaster);
router.put("/:id", authMiddleware, checkPermission("manage_masters"), upload.single("image"), updateMaster);
router.delete("/:id", authMiddleware, checkPermission("manage_masters"), deleteMaster);

export default router;
