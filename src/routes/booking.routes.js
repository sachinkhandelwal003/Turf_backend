import express from "express";
import {
  createBooking,
  getMyBookings,
  getTurfBookings,
  updateBookingStatus,
} from "../controllers/booking.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createBooking);
router.get("/my", authMiddleware, getMyBookings);
router.get("/turf/:turfId", authMiddleware, checkRole(["admin", "superadmin"]), getTurfBookings);
router.patch("/:id/status", authMiddleware, checkRole(["admin", "superadmin"]), updateBookingStatus);

export default router;
