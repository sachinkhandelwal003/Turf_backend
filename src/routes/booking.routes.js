import express from "express";
import {
  createBooking,
  getMyBookings,
  getTurfBookings,
  updateBookingStatus,
  getAllBookings,
  getAdminTurfBookings,
  getBookingById,
  processPayment,
  checkAvailability,
} from "../controllers/booking.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission, checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.get("/check-availability", checkAvailability);
router.post("/", authMiddleware, createBooking);
router.get("/my", authMiddleware, getMyBookings);
router.get("/all", authMiddleware, checkRole(["superadmin"]), getAllBookings);
router.get("/admin/my-turfs", authMiddleware, checkPermission("view_bookings"), getAdminTurfBookings);
router.get("/turf/:turfId", authMiddleware, getTurfBookings);
router.get("/:id", authMiddleware, getBookingById);
router.post("/:id/pay", authMiddleware, processPayment);
router.patch("/:id/status", authMiddleware, checkPermission("manage_bookings"), updateBookingStatus);

export default router;
