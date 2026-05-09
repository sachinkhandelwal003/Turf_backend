import express from "express";
import {
  createReview,
  getTurfReviews,
  getAllReviews,
  updateReviewStatus,
  deleteReview,
} from "../controllers/review.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createReview);
router.get("/turf/:turfId", getTurfReviews);
router.get("/all", authMiddleware, checkRole(["admin", "superadmin"]), getAllReviews);
router.patch("/:id/approve", authMiddleware, checkRole(["admin", "superadmin"]), updateReviewStatus);
router.delete("/:id", authMiddleware, checkRole(["admin", "superadmin"]), deleteReview);

export default router;
