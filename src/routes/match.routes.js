import express from "express";
import {
  createMatch,
  getMatches,
  getMatchById,
  joinMatch
} from "../controllers/match.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getMatches);
router.get("/:id", getMatchById);

// Protected routes
router.post("/", authMiddleware, createMatch);
router.post("/:id/join", authMiddleware, joinMatch);

export default router;
