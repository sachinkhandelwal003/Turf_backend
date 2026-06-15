import Booking from "../models/booking.model.js";
import Turf from "../models/turf.model.js";
import User from "../models/auth/user.model.js";
import Review from "../models/review.model.js";
import Settings from "../models/settings.model.js";
import { sendPushAndSave } from "../utils/firebase.js";
import { sendEmail } from "../utils/email.js";

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

const parseTimeToMinutes = (time) => {
  const [h, m] = (time || "00:00").split(":").map((v) => Number(v));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
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

// Helper to award coins for booking
const awardCoins = async (userId, bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking || booking.coinsAwarded) return;

    // Check how many confirmed/completed bookings the user has (excluding current one)
    const confirmedBookingsCount = await Booking.countDocuments({
      user: userId,
      status: { $in: ["confirmed", "completed"] },
      _id: { $ne: bookingId }
    });

    let coinsToAward = 0;
    if (confirmedBookingsCount === 0) {
      // First booking
      coinsToAward = 100;
    } else if (confirmedBookingsCount === 1) {
      // Second booking
      coinsToAward = 50;
    } else {
      // 3rd booking onwards
      coinsToAward = 0;
    }

    if (coinsToAward > 0) {
      await User.findByIdAndUpdate(userId, { $inc: { coins: coinsToAward } });
      console.log(`Awarded ${coinsToAward} coins to user ${userId} for booking ${bookingId}`);
    }

    booking.coinsAwarded = true;
    await booking.save();
  } catch (err) {
    console.error("Award Coins Error:", err);
  }
};

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req, res) => {
  try {
    console.log("Create Booking Request Body:", req.body);
    const { 
      turfId, sport, date, slot, slots, price, courts, 
      paymentStrategy, splitWithSquad, numberOfPlayers, convenienceFee,
      isOffline, userId, usedCoins, paymentMethod // Accept paymentMethod
    } = req.body;

    const slotList = slots || (slot ? [slot] : []);

    // For offline bookings, sport is optional; default to first sport of turf or "General"
    const finalSport = sport || (turfId ? (await Turf.findById(turfId))?.sports?.[0] || "General" : "General");
    
    if (!turfId || !date || slotList.length === 0 || price === undefined || !courts || !courts.length) {
      return res.status(400).json({ error: "Please provide all required fields including courts" });
    }

    // Check if user has enough coins if usedCoins is provided
    if (usedCoins && usedCoins > 0) {
      const user = await User.findById(req.user.id);
      if (user.coins < usedCoins) {
        return res.status(400).json({ error: "Insufficient coins" });
      }
    }

    // Determine the overall time range
    let minStart = "23:59";
    let maxEnd = "00:00";
    slotList.forEach(s => {
      const [start, end] = s.split(" - ");
      if (start < minStart) minStart = start;
      if (end > maxEnd) maxEnd = end;
    });

    // Check for overlaps with existing bookings
    // A slot is unavailable if there's any booking on the same date and turf
    // where any of the selected courts are used AND the time ranges overlap.
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingBookings = await Booking.find({
      turf: turfId,
      date,
      courts: { $in: courts },
      $or: [
        { status: { $in: ["confirmed", "completed"] } },
        { status: "pending", createdAt: { $gte: twoMinutesAgo } }
      ]
    });

    for (const eb of existingBookings) {
      // Check if any slot in slotList overlaps with eb's time range
      for (const s of slotList) {
        const [sStart, sEnd] = s.split(" - ");
        // Overlap condition: (sStart < eb.endTime) && (sEnd > eb.startTime)
        if (sStart < eb.endTime && sEnd > eb.startTime) {
          return res.status(400).json({ 
            error: `Slot ${s} is already booked for one or more selected courts` 
          });
        }
      }
    }

    // If we reach here, all slots are available
    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({ error: "Turf not found" });
    }

    // Calculate dynamic price based on slots
    let calculatedPrice = 0;
    const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
    const dayRate = turf.rates?.find(r => r.day === dayName)?.price;
    // Fix: Ensure we don't pick up 0 as the rate if pricePerHour is available
    const baseHourlyRate = Number((dayRate && dayRate > 0) ? dayRate : (turf.pricePerHour || 0));
    const duration = Number(turf.slotDuration || 60);

    slotList.forEach(s => {
      const [start, end] = s.split(" - ");
      const curMins = parseTimeToMinutes(start);
      const endMins = parseTimeToMinutes(end);
      const slotDurationMins = endMins - curMins;

      // 1. Check for slot-specific pricing
      const customSlot = turf.slotPricings?.find(sp => {
        const spStart = parseTimeToMinutes(sp.startTime);
        const spEnd = parseTimeToMinutes(sp.endTime);
        return curMins < spEnd && endMins > spStart;
      });

      if (customSlot) {
        calculatedPrice += (baseHourlyRate * (slotDurationMins / 60)) + Number(customSlot.price || 0);
      } else {
        calculatedPrice += (baseHourlyRate * (slotDurationMins / 60));
      }
    });

    // Final price multiplied by number of courts
    const finalPrice = calculatedPrice * (courts.length || 1);

    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const finalUserId = (isAdmin && userId) ? userId : req.user.id;
    const finalIsOffline = !!(isAdmin && isOffline);
    const finalPaymentStrategy = finalIsOffline ? 'full' : (paymentStrategy || 'full');

    const settings = await Settings.findOne();
    const resolvedConvenienceFee = Number(convenienceFee) || settings?.convenienceFee || 0;

    let totalAmount = finalPrice + resolvedConvenienceFee;
    
    // Deduct coins from total amount if used
    let coinDiscount = 0;
    if (usedCoins && usedCoins > 0) {
      const coinValue = settings?.coinValue || 1;
      coinDiscount = usedCoins * coinValue;
      totalAmount = Math.max(0, totalAmount - coinDiscount);
    }

    let paidAmount = 0;
    if (finalPaymentStrategy === 'full') {
      paidAmount = totalAmount;
    } else if (finalPaymentStrategy === 'partial') {
      // Partial = 25% of Venue Price + 100% of Fee - Discount
      paidAmount = (finalPrice * 0.25) + resolvedConvenienceFee - coinDiscount;
    }
    const balanceAmount = Math.max(0, totalAmount - paidAmount);

    const bookingId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const bookingData = {
      turf: turfId,
      user: finalUserId,
      sport: finalSport,
      date,
      startTime: minStart,
      endTime: maxEnd,
      slots: slotList,
      price: finalPrice,
      courts,
      bookingId,
      totalAmount,
      paidAmount,
      balanceAmount,
      usedCoins: Number(usedCoins) || 0,
      convenienceFee: resolvedConvenienceFee,
      paymentStrategy: finalPaymentStrategy,
      paymentMethod: paymentMethod || (finalIsOffline ? 'offline' : 'online'),
      splitWithSquad: splitWithSquad || false,
      numberOfPlayers: Number(numberOfPlayers) || 1,
      paymentStatus: finalIsOffline ? 'paid' : 'pending',
      status: finalIsOffline ? 'confirmed' : 'pending',
      isOffline: finalIsOffline,
      bookedByAdmin: isAdmin ? req.user.id : null
    };

    const booking = await Booking.create(bookingData);

    // If coins were used, deduct them from user
    if (usedCoins && usedCoins > 0) {
      await User.findByIdAndUpdate(req.user.id, { $inc: { coins: -usedCoins } });
    }

    // If offline booking (confirmed), award coins
    if (finalIsOffline) {
      await awardCoins(finalUserId, booking._id);
    }

    res.status(201).json({
      success: true,
      message: "Booking initiated successfully",
      booking
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
      .populate("turf", "name location images pricePerHour rates upiId")
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
      const b = bookings[0].toObject();
      return res.json({
        success: true,
        booking: {
          ...b,
          isMultiple: b.slots && b.slots.length > 1,
          bookingCount: b.slots ? b.slots.length : 1
        },
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
    const { paymentMethod, paymentId, usedCoins, paymentStrategy } = req.body;
    const ids = req.params.id.split(',');
    
    // Find bookings to get user IDs and current amounts
    const bookings = await Booking.find({ _id: { $in: ids } });

    // Validate and prepare coin discount if usedCoins is provided
    const settings = await Settings.findOne();
    const coinValue = settings?.coinValue || 1;
    
    let remainingDiscount = 0;
    if (usedCoins && usedCoins > 0) {
      const user = await User.findById(req.user.id);
      if (user.coins < usedCoins) {
        return res.status(400).json({ error: "Insufficient coins" });
      }

      // Deduct coins from user
      await User.findByIdAndUpdate(req.user.id, { $inc: { coins: -usedCoins } });
      remainingDiscount = usedCoins * coinValue;
    }

    // Process each booking to update payment details
    for (const booking of bookings) {
      // Update payment strategy if provided from frontend checkout choice
      if (paymentStrategy) {
        booking.paymentStrategy = paymentStrategy;
      }

      // Apply coin discount if there is any remaining discount
      if (remainingDiscount > 0) {
        const discountToApply = Math.min(remainingDiscount, booking.totalAmount);
        booking.usedCoins = (booking.usedCoins || 0) + (discountToApply / coinValue);
        booking.totalAmount = Math.max(0, booking.totalAmount - discountToApply);
        remainingDiscount -= discountToApply;
      }

      // Recalculate paidAmount and balanceAmount based on the (updated) paymentStrategy
      const resolvedConvenienceFee = booking.convenienceFee || 0;
      const coinDiscount = (booking.usedCoins || 0) * coinValue;
      const finalPrice = booking.price || 0;

      if (booking.paymentStrategy === 'full') {
        booking.paidAmount = booking.totalAmount;
      } else if (booking.paymentStrategy === 'partial') {
        // Partial = 25% of Venue Price + 100% of Fee - Discount
        booking.paidAmount = (finalPrice * 0.25) + resolvedConvenienceFee - coinDiscount;
      }
      booking.balanceAmount = Math.max(0, booking.totalAmount - booking.paidAmount);

      // Set booking payment and status fields
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      if (paymentMethod) booking.paymentMethod = paymentMethod;
      if (paymentId) booking.paymentId = paymentId;

      await booking.save();
    }

    // Award coins for each booking
    for (const booking of bookings) {
      await awardCoins(booking.user, booking._id);
      
      // 🔔 Send Booking Confirmed Notifications
      // First, populate user and turf details
      const populatedBooking = await Booking.findById(booking._id)
        .populate("user", "name email phone fcmToken")
        .populate("turf", "name location owner");
      
      if (populatedBooking) {
        // 🔹 Send to USER
        if (populatedBooking.user.fcmToken) {
          sendPushAndSave(
            populatedBooking.user._id,
            populatedBooking.user.fcmToken,
            "Booking Confirmed! 🎉",
            `Your ${populatedBooking.turf.name} booking is confirmed for ${populatedBooking.date} at ${populatedBooking.startTime}.`,
            "booking_confirmed",
            { bookingId: populatedBooking._id.toString() }
          ).catch(err => console.error("User booking notification error:", err));
        }
        
        // Send email to user
        if (populatedBooking.user.email) {
          sendEmail({
            email: populatedBooking.user.email,
            subject: "Your Booking is Confirmed!",
            message: `Hi ${populatedBooking.user.name},\n\nYour booking at ${populatedBooking.turf.name} is confirmed.\nDate: ${populatedBooking.date}\nTime: ${populatedBooking.startTime} - ${populatedBooking.endTime}\n\nThank you!`,
            html: `<p>Hi ${populatedBooking.user.name},</p><p>Your booking at <strong>${populatedBooking.turf.name}</strong> is confirmed.</p><p>Date: ${populatedBooking.date}<br>Time: ${populatedBooking.startTime} - ${populatedBooking.endTime}</p><p>Thank you!</p>`
          }).catch(err => console.error("User booking email error:", err));
        }
        
        // 🔹 Send to TURF OWNER
        if (populatedBooking.turf.owner) {
          const owner = await User.findById(populatedBooking.turf.owner);
          if (owner?.fcmToken) {
            sendPushAndSave(
              owner._id,
              owner.fcmToken,
              "New Booking! 🏟️",
              `${populatedBooking.user.name} has booked ${populatedBooking.turf.name} for ${populatedBooking.date} at ${populatedBooking.startTime}.`,
              "new_booking",
              { bookingId: populatedBooking._id.toString() }
            ).catch(err => console.error("Owner booking notification error:", err));
          }
          
          if (owner?.email) {
            sendEmail({
              email: owner.email,
              subject: "New Booking Received!",
              message: `Hi ${owner.name},\n\n${populatedBooking.user.name} has booked your turf ${populatedBooking.turf.name} for ${populatedBooking.date} at ${populatedBooking.startTime}.`,
              html: `<p>Hi ${owner.name},</p><p><strong>${populatedBooking.user.name}</strong> has booked your turf <strong>${populatedBooking.turf.name}</strong>.</p><p>Date: ${populatedBooking.date}<br>Time: ${populatedBooking.startTime} - ${populatedBooking.endTime}</p>`
            }).catch(err => console.error("Owner booking email error:", err));
          }
        }
      }
    }

    res.json({
      success: true,
      message: "Payment processed successfully",
      count: bookings.length
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
      .populate("turf", "name location images pricePerHour rates")
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

    // Award coins if status is confirmed or completed
    if (["confirmed", "completed"].includes(status)) {
      await awardCoins(booking.user, booking._id);
    }

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

    const [bookings, totalCount] = await Promise.all([
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
    
    // To keep the total count accurate based on valid (non-orphan) bookings, 
    // we need to adjust the total if we're filtering orphans.
    // However, for pagination to work correctly with large datasets, 
    // it's better to just show valid ones.
    
    res.json({
      success: true,
      bookings: validBookings,
      total: validBookings.length, // Showing only valid bookings count
      pages: Math.ceil(validBookings.length / limit),
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

    console.log(`Checking availability for Turf: ${turfId} on Date: ${date}`);

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const bookings = await Booking.find({
      turf: turfId,
      date: date,
      $or: [
        { status: { $in: ["confirmed", "completed"] } },
        { status: "pending", createdAt: { $gte: twoMinutesAgo } }
      ]
    }).select("startTime endTime courts slots status sport");

    console.log(`Found ${bookings.length} active bookings`);

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
    // Include fields needed by admin panel (offline booking slot generation, court selection, etc.)
    const myTurfs = await Turf.find({ owner: req.user.id }).select(
      "_id name sports courts operatingHours slotDuration availableSlots"
    );
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

    const [bookings, totalCount] = await Promise.all([
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
      total: validBookings.length,
      pages: Math.ceil(validBookings.length / limit),
      currentPage: parseInt(page),
      myTurfs: myTurfs
    });
  } catch (err) {
    console.error("Get Admin Turf Bookings Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get checkout details (Availability + Pricing)
// @route   POST /api/bookings/checkout
// @access  Private
export const getCheckoutDetails = async (req, res) => {
  try {
    const { 
      turfId, sport, date, slots, courts, usedCoins 
    } = req.body;

    if (!turfId || !sport || !date || !slots || !slots.length || !courts || !courts.length) {
      return res.status(400).json({ error: "Missing required checkout parameters" });
    }

    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({ error: "Turf not found" });
    }

    // 1. Check Availability
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingBookings = await Booking.find({
      turf: turfId,
      date,
      courts: { $in: courts },
      $or: [
        { status: { $in: ["confirmed", "completed"] } },
        { status: "pending", createdAt: { $gte: twoMinutesAgo } }
      ]
    });

    for (const eb of existingBookings) {
      for (const s of slots) {
        const [sStart, sEnd] = s.split(" - ");
        if (sStart < eb.endTime && sEnd > eb.startTime) {
          return res.status(400).json({ 
            available: false,
            error: `Slot ${s} is already booked for one or more selected courts` 
          });
        }
      }
    }

    // 2. Calculate Pricing Breakdown
    let basePrice = 0;
    let surchargeAmount = 0;
    let customSlotAmount = 0;

    const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
    const dayRate = turf.rates?.find(r => r.day === dayName);
    const baseHourlyRate = Number((dayRate?.price && dayRate.price > 0) ? dayRate.price : (turf.pricePerHour || 0));

    slots.forEach(s => {
      const [start, end] = s.split(" - ");
      const curMins = parseTimeToMinutes(start);
      const endMins = parseTimeToMinutes(end);
      const slotDurationHrs = (endMins - curMins) / 60;

      // Base amount for this slot
      basePrice += baseHourlyRate * slotDurationHrs;

      // Custom slot pricing
      const customSlot = turf.slotPricings?.find(sp => {
        const spStart = parseTimeToMinutes(sp.startTime);
        const spEnd = parseTimeToMinutes(sp.endTime);
        return curMins < spEnd && endMins > spStart;
      });

      if (customSlot) {
        customSlotAmount += Number(customSlot.price || 0);
      }
    });

    // Multiply by courts
    const subtotal = (basePrice + customSlotAmount) * courts.length;

    // Convenience fee from settings
    const settings = await Settings.findOne();
    const convenienceFee = settings?.convenienceFee || 0;

    // Coin discount
    let coinDiscount = 0;
    if (usedCoins && usedCoins > 0) {
      const user = await User.findById(req.user.id);
      if (user.coins >= usedCoins) {
        const coinValue = settings?.coinValue || 1;
        coinDiscount = usedCoins * coinValue;
      }
    }

    const totalAmount = Math.max(0, subtotal + convenienceFee - coinDiscount);

    res.json({
      success: true,
      available: true,
      breakdown: {
        basePrice: subtotal - customSlotAmount * courts.length,
        customSlotPricing: customSlotAmount * courts.length,
        convenienceFee,
        coinDiscount,
        subtotal: subtotal + convenienceFee,
        totalAmount
      },
      paymentDetails: {
        upiId: turf.upiId,
        merchantName: turf.name,
        paymentMethods: ["upi", "card", "wallet"]
      }
    });
  } catch (err) {
    console.error("Checkout API Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Cancel my booking
// @route   POST /api/bookings/:id/cancel
// @access  Private
export const cancelMyBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check ownership
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to cancel this booking" });
    }

    // Check if it's already cancelled or completed
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: "Booking is already cancelled" });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ error: "Cannot cancel a completed booking" });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking
    });
  } catch (err) {
    console.error("Cancel Booking Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Delete a booking
// @route   DELETE /api/bookings/:id
// @access  Private (Admin/Superadmin)
export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // RBAC: Only admin who owns the turf or superadmin can delete
    // First find the turf to check owner
    const turf = await Turf.findById(booking.turf);
    
    if (req.user.role !== 'superadmin') {
      if (!turf || turf.owner.toString() !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to delete this booking" });
      }
    }

    await booking.deleteOne();

    res.json({
      success: true,
      message: "Booking deleted successfully"
    });
  } catch (err) {
    console.error("Delete Booking Error:", err);
    res.status(500).json({ error: "Server Error while deleting booking" });
  }
};
  