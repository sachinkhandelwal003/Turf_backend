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
  deleteBooking,
  getCheckoutDetails,
  cancelMyBooking,
} from "../controllers/booking.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.get("/check-availability", checkAvailability);
router.post("/checkout", authMiddleware, getCheckoutDetails);
router.post("/", authMiddleware, createBooking);
router.get("/my", authMiddleware, getMyBookings);
router.get("/all", authMiddleware, checkRole(["superadmin"]), getAllBookings);
router.get(
  "/admin/my-turfs",
  authMiddleware,
  checkRole(["admin", "superadmin"]),
  getAdminTurfBookings
);
router.get("/turf/:turfId", authMiddleware, getTurfBookings);
router.get("/:id", authMiddleware, getBookingById);
router.post("/:id/pay", authMiddleware, processPayment);
router.post("/:id/cancel", authMiddleware, cancelMyBooking);
router.patch("/:id/status", authMiddleware, checkRole(["admin", "superadmin"]), updateBookingStatus);
router.delete("/:id", authMiddleware, checkRole(["admin", "superadmin"]), deleteBooking);

export default router;
