import express from "express";
import { getMasters, createMaster, deleteMaster, updateMaster } from "../controllers/master.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.get("/", getMasters);
router.post("/", authMiddleware, checkRole(["superadmin"]), upload.single("image"), createMaster);
router.delete("/:id", authMiddleware, checkRole(["superadmin"]), deleteMaster);

export default router;
