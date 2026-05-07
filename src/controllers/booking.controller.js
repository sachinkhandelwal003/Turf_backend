import Booking from "../models/booking.model.js";
import Turf from "../models/turf.model.js";
import User from "../models/auth/user.model.js";
import Review from "../models/review.model.js";

const getTodayParts = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    today: `${year}-${month}-${day}`,
    currentTime: now.toTimeString().slice(0, 5),
  };
};

const completedBookingQuery = (today, currentTime) => ({
  $or: [
    { status: "completed" },
    { status: "confirmed", date: { $lt: today } },
    { status: "confirmed", date: today, endTime: { $lte: currentTime } },
  ],
});

const activeUpcomingQuery = (today, currentTime) => ({
  status: { $in: ["pending", "confirmed"] },
  $or: [
    { date: { $gt: today } },
    { date: today, endTime: { $gt: currentTime } },
  ],
});

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req, res) => {
  try {
    console.log("Create Booking Request Body:", req.body);
    const { 
      turfId, sport, date, slot, slots, price, courts, 
      paymentStrategy, splitWithSquad, numberOfPlayers, convenienceFee 
    } = req.body;

    // Support both single slot and multiple slots
    const slotList = slots || (slot ? [slot] : []);

    if (!turfId || !sport || !date || slotList.length === 0 || price === undefined || !courts || !courts.length) {
      console.log("Missing required fields:", { turfId, sport, date, slotList, price, courts });
      return res.status(400).json({ error: "Please provide all required fields including courts" });
    }

    const createdBookings = [];
    const pricePerSlot = Number(price) / slotList.length;
    const feePerSlot = (Number(convenienceFee) || 0) / slotList.length;

    for (let i = 0; i < slotList.length; i++) {
      const currentSlot = slotList[i];
      const [startTime, endTime] = currentSlot.split(" - ");
      
      // Check if any of the selected courts are already booked for this slot
      const existingBooking = await Booking.findOne({
        turf: turfId,
        date,
        startTime,
        status: { $ne: "cancelled" },
        courts: { $in: courts }
      });

      if (existingBooking) {
        return res.status(400).json({ 
          error: `Slot ${currentSlot} is already booked for one or more selected courts` 
        });
      }

      // Generate a unique booking ID
      const bookingId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}${i}`;
      
      const totalAmount = pricePerSlot + feePerSlot;
      let paidAmount = 0;
      if (paymentStrategy === 'full') {
        paidAmount = totalAmount;
      } else if (paymentStrategy === 'partial') {
        paidAmount = totalAmount * 0.25;
      }
      const balanceAmount = totalAmount - paidAmount;

      const bookingData = {
        turf: turfId,
        user: req.user.id,
        sport,
        date,
        startTime,
        endTime,
        price: pricePerSlot,
        courts,
        bookingId,
        totalAmount,
        paidAmount,
        balanceAmount,
        convenienceFee: feePerSlot,
        paymentStrategy: paymentStrategy || 'full',
        splitWithSquad: splitWithSquad || false,
        numberOfPlayers: Number(numberOfPlayers) || 1,
        paymentStatus: 'pending'
      };

      const booking = await Booking.create(bookingData);
      createdBookings.push(booking);
    }

    res.status(201).json({
      success: true,
      message: `${createdBookings.length} booking(s) initiated successfully`,
      booking: createdBookings[0],
      bookings: createdBookings
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
    const ids = req.params.id.split(',');
    const bookings = await Booking.find({ _id: { $in: ids } })
      .populate("turf", "name location images pricePerHour")
      .populate("user", "name email phone");

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check authorization for all bookings
    for (const booking of bookings) {
      if (req.user.role !== 'superadmin' && 
          booking.user._id.toString() !== req.user.id && 
          booking.turf.owner?.toString() !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
    }

    if (bookings.length === 1) {
      return res.json({
        success: true,
        booking: bookings[0],
      });
    }

    // Aggregate multiple bookings for checkout display
    const aggregated = {
      _id: req.params.id, // Keep the comma-separated IDs
      bookingId: bookings.map(b => b.bookingId.slice(-4)).join(', '),
      turf: bookings[0].turf,
      sport: bookings[0].sport,
      date: bookings[0].date,
      startTime: bookings[0].startTime, // Use first one's start
      endTime: bookings[bookings.length - 1].endTime, // Use last one's end
      courts: bookings[0].courts,
      price: bookings.reduce((sum, b) => sum + b.price, 0),
      totalAmount: bookings.reduce((sum, b) => sum + b.totalAmount, 0),
      paidAmount: bookings.reduce((sum, b) => sum + b.paidAmount, 0),
      balanceAmount: bookings.reduce((sum, b) => sum + b.balanceAmount, 0),
      convenienceFee: bookings.reduce((sum, b) => sum + b.convenienceFee, 0),
      paymentStatus: bookings[0].paymentStatus,
      status: bookings[0].status
    };

    res.json({
      success: true,
      booking: aggregated,
      isMultiple: true,
      originalBookings: bookings
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
    const ids = req.params.id.split(',');
    
    const results = await Booking.updateMany(
      { _id: { $in: ids } },
      { 
        $set: { 
          paymentStatus: 'paid',
          status: 'confirmed',
          paymentMethod,
          paymentId
        } 
      }
    );

    res.json({
      success: true,
      message: "Payment processed successfully",
      count: results.modifiedCount
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
    const { today, currentTime } = getTodayParts();
    let query = { user: req.user.id };

    if (filter === 'upcoming') {
      query = { ...query, ...activeUpcomingQuery(today, currentTime) };
    } else if (filter === 'completed') {
      query = { ...query, ...completedBookingQuery(today, currentTime) };
    } else if (filter === 'cancelled') {
      query.status = 'cancelled';
    }

    const bookings = await Booking.find(query)
      .populate("turf", "name location images")
      .sort("-date -startTime");

    const reviewedBookingIds = await Review.find({
      user: req.user.id,
      booking: { $in: bookings.map((booking) => booking._id) },
    }).distinct("booking");
    const reviewedSet = new Set(reviewedBookingIds.map((id) => id.toString()));
    const bookingsWithReviewState = bookings.map((booking) => ({
      ...booking.toObject(),
      hasReviewed: reviewedSet.has(booking._id.toString()),
    }));

    res.json({
      success: true,
      bookings: bookingsWithReviewState,
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
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      status = "all",
      startDate,
      endDate,
      startTime,
      endTime,
      turfId
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    // Turf ID filter
    if (turfId) {
      query.turf = turfId;
    }

    // Status filter
    if (status !== "all") {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startDate;
      }
      if (endDate) {
        query.date.$lte = endDate;
      }
    }

    // Time range filter
    if (startTime || endTime) {
      if (startTime) {
        query.startTime = { $gte: startTime };
      }
      if (endTime) {
        query.endTime = { $lte: endTime };
      }
    }

    // Search filter (User name/email or Turf name)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      
      // Find matching users and turfs first
      const [users, turfs] = await Promise.all([
        User.find({ $or: [{ name: searchRegex }, { email: searchRegex }] }).select("_id"),
        Turf.find({ name: searchRegex }).select("_id")
      ]);

      const userIds = users.map(u => u._id);
      const turfIds = turfs.map(t => t._id);

      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { user: { $in: userIds } },
          { turf: { $in: turfIds } },
          { bookingId: searchRegex }
        ]
      });
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("turf", "name location images owner")
        .populate("user", "name email phone profilePhoto")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query)
    ]);

    // Filter out bookings where turf was deleted (orphans)
    const validBookings = bookings.filter(b => b.turf !== null);

    res.json({
      success: true,
      bookings: validBookings,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (err) {
    console.error("Get All Bookings Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Check availability for a turf on a specific date
// @route   GET /api/bookings/check-availability
// @access  Public
export const checkAvailability = async (req, res) => {
  try {
    const { turfId, date } = req.query;

    if (!turfId || !date) {
      return res.status(400).json({ error: "Turf ID and date are required" });
    }

    const bookings = await Booking.find({
      turf: turfId,
      date,
      status: { $ne: "cancelled" }
    }).select("startTime endTime courts");

    res.json({
      success: true,
      bookedSlots: bookings
    });
  } catch (err) {
    console.error("Check Availability Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get bookings for admin's turfs
// @route   GET /api/bookings/admin/my-turfs
// @access  Private (Admin)
export const getAdminTurfBookings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      status = "all",
      startDate,
      endDate,
      startTime,
      endTime,
      turfId
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 1. Find all turfs owned by this admin
    const myTurfs = await Turf.find({ owner: req.user.id }).select("_id name");
    const myTurfIds = myTurfs.map(t => t._id);

    let query = { turf: { $in: myTurfIds } };

    // Turf ID filter (must be within admin's own turfs)
    if (turfId && myTurfIds.some(id => id.toString() === turfId.toString())) {
      query.turf = turfId;
    }

    // Status filter
    if (status !== "all") {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startDate;
      }
      if (endDate) {
        query.date.$lte = endDate;
      }
    }

    // Time range filter
    if (startTime || endTime) {
      if (startTime) {
        query.startTime = { $gte: startTime };
      }
      if (endTime) {
        query.endTime = { $lte: endTime };
      }
    }

    // Search filter (User name/email or Turf name)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      
      // Find matching users and turfs (within admin's own turfs) first
      const [users, turfs] = await Promise.all([
        User.find({ $or: [{ name: searchRegex }, { email: searchRegex }] }).select("_id"),
        Turf.find({ name: searchRegex, _id: { $in: myTurfIds } }).select("_id")
      ]);

      const userIds = users.map(u => u._id);
      const turfIds = turfs.map(t => t._id);

      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { user: { $in: userIds } },
          { turf: { $in: turfIds } },
          { bookingId: searchRegex }
        ]
      });
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("turf", "name location images")
        .populate("user", "name email phone profilePhoto")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query)
    ]);

    // Filter out bookings where turf was deleted (orphans)
    const validBookings = bookings.filter(b => b.turf !== null);

    res.json({
      success: true,
      bookings: validBookings,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      myTurfs: myTurfs
    });
  } catch (err) {
    console.error("Get Admin Turf Bookings Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
