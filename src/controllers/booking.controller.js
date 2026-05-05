import Booking from "../models/booking.model.js";
import Turf from "../models/turf.model.js";

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req, res) => {
  try {
    const { turfId, sport, date, slot, price } = req.body;

    if (!turfId || !sport || !date || !slot || !price) {
      return res.status(400).json({ error: "Please provide all required fields" });
    }

    const [startTime, endTime] = slot.split(" - ");

    // Check if slot is already booked
    const existingBooking = await Booking.findOne({
      turf: turfId,
      date,
      startTime,
      status: { $ne: "cancelled" },
    });

    if (existingBooking) {
      return res.status(400).json({ error: "This time slot is already booked" });
    }

    const booking = await Booking.create({
      turf: turfId,
      user: req.user.id,
      sport,
      date,
      startTime,
      endTime,
      price,
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (err) {
    console.error("Create Booking Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get all bookings for a user
// @route   GET /api/bookings/my
// @access  Private
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate("turf", "name location images")
      .sort("-createdAt");

    res.json({
      success: true,
      bookings,
    });
  } catch (err) {
    console.error("Get My Bookings Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get all bookings for a turf (for owners/admins)
// @route   GET /api/bookings/turf/:turfId
// @access  Private (Admin/Superadmin)
export const getTurfBookings = async (req, res) => {
  try {
    const { turfId } = req.params;
    
    // Check if user owns the turf or is superadmin
    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({ error: "Turf not found" });
    }

    if (req.user.role !== "superadmin" && turf.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to view bookings for this turf" });
    }

    const bookings = await Booking.find({ turf: turfId })
      .populate("user", "name email phone")
      .sort("-date -startTime");

    res.json({
      success: true,
      bookings,
    });
  } catch (err) {
    console.error("Get Turf Bookings Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Update booking status
// @route   PATCH /api/bookings/:id/status
// @access  Private (Admin/Superadmin)
export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const booking = await Booking.findById(req.params.id).populate("turf");
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check authorization
    if (req.user.role !== "superadmin" && booking.turf.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    booking.status = status;
    await booking.save();

    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      booking,
    });
  } catch (err) {
    console.error("Update Booking Status Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
