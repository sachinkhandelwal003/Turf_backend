import express from "express";
import { getMasters, createMaster, deleteMaster } from "../controllers/master.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.get("/", getMasters);
router.post("/", authMiddleware, checkRole(["superadmin"]), createMaster);
router.delete("/:id", authMiddleware, checkRole(["superadmin"]), deleteMaster);

export default router;
