import Booking from "../models/booking.model.js";
import Turf from "../models/turf.model.js";
import User from "../models/auth/user.model.js";

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req, res) => {
  try {
    console.log("Create Booking Request Body:", req.body);
    const { 
      turfId, sport, date, slot, price, courts, 
      paymentStrategy, splitWithSquad, numberOfPlayers, convenienceFee 
    } = req.body;

    if (!turfId || !sport || !date || !slot || !price || !courts || !courts.length) {
      console.log("Missing required fields:", { turfId, sport, date, slot, price, courts });
      return res.status(400).json({ error: "Please provide all required fields including courts" });
    }

    const [startTime, endTime] = slot.split(" - ");
    console.log("Parsed times:", { startTime, endTime });

    // Check if any of the selected courts are already booked for this slot
    const existingBooking = await Booking.findOne({
      turf: turfId,
      date,
      startTime,
      status: { $ne: "cancelled" },
      courts: { $in: courts }
    });

    if (existingBooking) {
      console.log("Found existing booking:", existingBooking._id);
      return res.status(400).json({ error: "One or more selected courts are already booked for this time slot" });
    }

    // Generate a unique booking ID
    const bookingId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    console.log("Generated bookingId:", bookingId);

    const totalAmount = Number(price) + (Number(convenienceFee) || 0);
    let paidAmount = 0;
    if (paymentStrategy === 'full') {
      paidAmount = totalAmount;
    } else if (paymentStrategy === 'partial') {
      paidAmount = totalAmount * 0.25; // 25% payment
    }
    const balanceAmount = totalAmount - paidAmount;

    console.log("Calculation details:", { totalAmount, paidAmount, balanceAmount });

    const bookingData = {
      turf: turfId,
      user: req.user.id,
      sport,
      date,
      startTime,
      endTime,
      price: Number(price),
      courts,
      bookingId,
      totalAmount,
      paidAmount,
      balanceAmount,
      convenienceFee: Number(convenienceFee) || 0,
      paymentStrategy: paymentStrategy || 'full',
      splitWithSquad: splitWithSquad || false,
      numberOfPlayers: Number(numberOfPlayers) || 1,
      paymentStatus: 'pending'
    };

    console.log("Creating booking with data:", bookingData);
    const booking = await Booking.create(bookingData);

    res.status(201).json({
      success: true,
      message: "Booking initiated successfully",
      booking,
    });
  } catch (err) {
    console.error("Create Booking Error Details:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("turf", "name location images pricePerHour")
      .populate("user", "name email phone");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check authorization
    if (req.user.role !== 'superadmin' && 
        booking.user._id.toString() !== req.user.id && 
        booking.turf.owner?.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("Get Booking By ID Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Process payment for a booking
// @route   POST /api/bookings/:id/pay
// @access  Private
export const processPayment = async (req, res) => {
  try {
    const { paymentMethod, paymentId } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.paymentMethod = paymentMethod;
    booking.paymentId = paymentId;

    await booking.save();

    res.json({
      success: true,
      message: "Payment processed successfully",
      booking,
    });
  } catch (err) {
    console.error("Process Payment Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get all bookings for a user
// @route   GET /api/bookings/my
// @access  Private
export const getMyBookings = async (req, res) => {
  try {
    const { filter } = req.query; // upcoming, completed, cancelled
    let query = { user: req.user.id };

    if (filter === 'upcoming') {
      query.status = { $in: ['pending', 'confirmed'] };
      // Also could filter by date >= today
    } else if (filter === 'completed') {
      query.status = 'completed';
    } else if (filter === 'cancelled') {
      query.status = 'cancelled';
    }

    const bookings = await Booking.find(query)
      .populate("turf", "name location images")
      .sort("-date -startTime");

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
    const { date } = req.query;
    
    // Check if turf exists
    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({ error: "Turf not found" });
    }

    // Build query
    let query = { turf: turfId };
    if (date) {
      query.date = date;
    }

    const bookings = await Booking.find(query)
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

// @desc    Get all bookings (Superadmin)
// @route   GET /api/bookings/all
// @access  Private (Superadmin only)
export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("turf", "name location images owner")
      .populate("user", "name email phone")
      .sort("-createdAt");

    res.json({
      success: true,
      bookings,
    });
  } catch (err) {
    console.error("Get All Bookings Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get bookings for admin's turfs
// @route   GET /api/bookings/admin/my-turfs
// @access  Private (Admin only)
export const getAdminTurfBookings = async (req, res) => {
  try {
    // 1. Find all turfs owned by this admin
    const myTurfs = await Turf.find({ owner: req.user.id }).select("_id");
    const turfIds = myTurfs.map(t => t._id);

    // 2. Find all bookings for these turfs
    const bookings = await Booking.find({ turf: { $in: turfIds } })
      .populate("turf", "name location images")
      .populate("user", "name email phone")
      .sort("-createdAt");

    res.json({
      success: true,
      bookings,
    });
  } catch (err) {
    console.error("Get Admin Turf Bookings Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
