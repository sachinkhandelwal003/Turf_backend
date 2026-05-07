import express from "express";
import {
  createReview,
  getTurfReviews,
  getAllReviews,
  updateReviewStatus,
  deleteReview,
} from "../controllers/review.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createReview);
router.get("/turf/:turfId", getTurfReviews);
router.get("/all", authMiddleware, checkPermission("view_reviews"), getAllReviews);
router.patch("/:id/approve", authMiddleware, checkPermission("manage_reviews"), updateReviewStatus);
router.delete("/:id", authMiddleware, checkPermission("manage_reviews"), deleteReview);

export default router;
