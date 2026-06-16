import Booking from "../models/booking.model.js";
import Refund from "../models/refund.model.js";
import Settings from "../models/settings.model.js";
import { sendPushAndSave } from "../utils/firebase.js";
import { sendEmail } from "../utils/email.js";

// Helper to calculate hours difference between booking start and now
const getHoursUntilBooking = (booking) => {
  const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
  const now = new Date();
  const diffMs = bookingDateTime - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours;
};

// Helper to get refund category based on hours
const getRefundCategory = (hoursUntilBooking) => {
  if (hoursUntilBooking > 24) {
    return "more_than_24h";
  } else if (hoursUntilBooking >= 12 && hoursUntilBooking <= 24) {
    return "12_to_24h";
  } else if (hoursUntilBooking >= 2 && hoursUntilBooking < 12) {
    return "2_to_12h";
  } else {
    return "less_than_2h";
  }
};

// Helper to calculate refund and owner compensation
const calculateRefund = (booking, hoursUntilBooking) => {
  const category = getRefundCategory(hoursUntilBooking);
  const totalAmount = booking.paidAmount;
  const adminShare = booking.adminCommission || totalAmount * 0.2;
  const ownerShare = booking.ownerShare || totalAmount * 0.8;

  let refundPercentage;
  let ownerKeepsPercentage;
  let policyNote;

  switch (category) {
    case "more_than_24h":
      refundPercentage = 100;
      ownerKeepsPercentage = 0;
      policyNote = "Full refund: 100% to player, owner compensation reversed";
      break;
    case "12_to_24h":
      refundPercentage = 50;
      ownerKeepsPercentage = 50;
      policyNote = "50% refund: 50% to player, owner keeps 50% of share";
      break;
    case "2_to_12h":
    case "less_than_2h":
    default:
      refundPercentage = 0;
      ownerKeepsPercentage = 100;
      policyNote = "0% refund: Owner keeps full share";
      break;
  }

  const refundAmount = (totalAmount * refundPercentage) / 100;
  const ownerKeepsAmount = (ownerShare * ownerKeepsPercentage) / 100;
  const adminKeepsAmount = adminShare;

  return {
    category,
    refundPercentage,
    ownerKeepsPercentage,
    refundAmount,
    ownerKeepsAmount,
    adminKeepsAmount,
    totalAmount,
    adminShare,
    ownerShare,
    policyNote,
    canCancel: true
  };
};

// @desc    Get Refund Preview (Calculate refund amount before cancel)
// @route   GET /api/bookings/:bookingId/refund-preview
// @access  Private
export const getRefundPreview = async (req, res) => {
  try {
    console.log("Refund Preview Request - Params:", req.params);
    console.log("Refund Preview Request - User:", req.user?.id);
    
    // Try to find by _id first (if it looks like ObjectId), then by bookingId
    let booking;
    const bookingIdParam = req.params.bookingId;
    
    // Check if the param looks like a MongoDB ObjectId (24 hex chars)
    if (/^[0-9a-fA-F]{24}$/.test(bookingIdParam)) {
      console.log("Trying to find by _id:", bookingIdParam);
      booking = await Booking.findById(bookingIdParam);
    }
    
    // If not found or not ObjectId, try by bookingId
    if (!booking) {
      console.log("Trying to find by bookingId:", bookingIdParam);
      booking = await Booking.findOne({ bookingId: bookingIdParam });
    }

    if (!booking) {
      console.log("Booking not found at all for:", req.params.bookingId);
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("Found booking:", booking._id, booking.bookingId);
    console.log("Booking user (raw):", booking.user, "Type:", typeof booking.user);
    console.log("Req user:", req.user);
    console.log("Req user _id:", req.user._id, "Type:", typeof req.user._id);

    // Check ownership OR admin/owner role
    const bookingUserId = booking.user.toString();
    const requestUserId = req.user._id.toString();
    const userRole = req.user.role;
    
    console.log("Comparing - Booking user:", bookingUserId, "Req user:", requestUserId, "User role:", userRole, "Match?", bookingUserId === requestUserId || ["admin", "superadmin", "owner"].includes(userRole));
    
    if (!(bookingUserId === requestUserId || ["admin", "superadmin", "owner"].includes(userRole))) {
      console.log("Authorization check FAILED!");
      return res.status(403).json({ error: "Not authorized" });
    }
    console.log("Authorization check PASSED!");

    // Check if booking is already cancelled or completed
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      console.log("Booking status check failed:", booking.status);
      return res.status(400).json({ error: "Cannot get refund preview for this booking" });
    }

    const hoursUntilBooking = getHoursUntilBooking(booking);
    const refundData = calculateRefund(booking, hoursUntilBooking);

    res.json({
      success: true,
      data: {
        ...refundData,
        hoursUntilBooking: Math.round(hoursUntilBooking * 10) / 10
      }
    });
  } catch (err) {
    console.error("Refund Preview Error:", err);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
};

// @desc    Cancel Booking (with new policy)
// @route   POST /api/bookings/:bookingId/cancel
// @access  Private
export const cancelBooking = async (req, res) => {
  try {
    console.log("Cancel Booking Request - Params:", req.params);
    console.log("Cancel Booking Request - User:", req.user?.id);
    
    // Try to find by _id first (if it looks like ObjectId), then by bookingId
    let booking;
    const bookingIdParam = req.params.bookingId;
    
    // Check if the param looks like a MongoDB ObjectId (24 hex chars)
    if (/^[0-9a-fA-F]{24}$/.test(bookingIdParam)) {
      console.log("Trying to find by _id:", bookingIdParam);
      booking = await Booking.findById(bookingIdParam);
    }
    
    // If not found or not ObjectId, try by bookingId
    if (!booking) {
      console.log("Trying to find by bookingId:", bookingIdParam);
      booking = await Booking.findOne({ bookingId: bookingIdParam });
    }

    if (!booking) {
      console.log("Booking not found at all for:", req.params.bookingId);
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("Found booking for cancel:", booking._id, booking.bookingId);
    console.log("Booking user (raw):", booking.user, "Type:", typeof booking.user);
    console.log("Req user:", req.user);
    console.log("Req user _id:", req.user._id, "Type:", typeof req.user._id);

    // Check ownership
    const bookingUserId = booking.user.toString();
    const requestUserId = req.user._id.toString();
    console.log("Comparing - Booking user:", bookingUserId, "Req user:", requestUserId, "Match?", bookingUserId === requestUserId);
    
    if (bookingUserId !== requestUserId) {
      console.log("Ownership check FAILED!");
      return res.status(403).json({ error: "Not authorized to cancel this booking" });
    }
    console.log("Ownership check PASSED!");

    // Check if it's already cancelled or completed
    if (booking.status === 'cancelled') {
      console.log("Booking is already cancelled");
      return res.status(400).json({ error: "Booking is already cancelled" });
    }
    if (booking.status === 'completed') {
      console.log("Booking is completed, cannot cancel");
      return res.status(400).json({ error: "Cannot cancel a completed booking" });
    }

    const hoursUntilBooking = getHoursUntilBooking(booking);
    const refundData = calculateRefund(booking, hoursUntilBooking);

    // Update booking status and cancellation details
    booking.status = 'cancelled';
    booking.cancellationDetails = {
      category: refundData.category,
      hoursUntilBooking: Math.round(hoursUntilBooking * 10) / 10,
      refundAmount: refundData.refundAmount,
      ownerKeepsAmount: refundData.ownerKeepsAmount,
      adminKeepsAmount: refundData.adminKeepsAmount,
      policyNote: refundData.policyNote
    };
    await booking.save();
    console.log("Booking status updated to cancelled");

    // If payment was made, create a refund request automatically
    if (booking.paymentStatus === 'paid' && booking.paidAmount > 0) {
      console.log("Creating automatic refund request for amount:", refundData.refundAmount);
      // Create automatic refund request (user-initiated)
      await Refund.create({
        booking: booking._id,
        user: booking.user,
        reason: "user_initiated",
        description: refundData.policyNote,
        amount: refundData.refundAmount,
        status: refundData.refundAmount > 0 ? "PENDING" : "PROCESSED"
      });
      console.log("Refund request created successfully");
    }

    // Send notifications
    const populatedBooking = await Booking.findById(booking._id)
      .populate("user", "name email phone fcmToken")
      .populate("turf", "name location owner");

    if (populatedBooking) {
      if (populatedBooking.user.fcmToken) {
        sendPushAndSave(
          populatedBooking.user._id,
          populatedBooking.user.fcmToken,
          "Booking Cancelled",
          `Your ${populatedBooking.turf.name} booking has been cancelled. ${refundData.policyNote}`,
          "booking_cancelled",
          { bookingId: populatedBooking._id.toString() }
        ).catch(err => console.error("Notification error:", err));
      }
    }

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking
    });
  } catch (err) {
    console.error("Cancel Booking Error:", err);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
};

// @desc    Request a Refund (for venue issues etc.)
// @route   POST /api/refunds/request
// @access  Private
export const requestRefund = async (req, res) => {
  try {
    console.log("Request Refund - Body:", req.body);
    console.log("Request Refund - User:", req.user?._id);
    
    // Try to find by _id first (if it looks like ObjectId), then by bookingId
    let booking;
    const bookingIdParam = req.body.bookingId;
    
    if (/^[0-9a-fA-F]{24}$/.test(bookingIdParam)) {
      console.log("Trying to find by _id:", bookingIdParam);
      booking = await Booking.findById(bookingIdParam);
    }
    
    if (!booking) {
      console.log("Trying to find by bookingId:", bookingIdParam);
      booking = await Booking.findOne({ bookingId: bookingIdParam });
    }

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("Found booking for refund request:", booking._id, booking.bookingId);

    // Check ownership OR admin/owner role
    const bookingUserId = booking.user.toString();
    const requestUserId = req.user._id.toString();
    const userRole = req.user.role;
    
    console.log("Comparing - Booking user:", bookingUserId, "Req user:", requestUserId, "User role:", userRole, "Match?", bookingUserId === requestUserId || ["admin", "superadmin", "owner"].includes(userRole));
    
    if (!(bookingUserId === requestUserId || ["admin", "superadmin", "owner"].includes(userRole))) {
      console.log("Authorization check FAILED!");
      return res.status(403).json({ error: "Not authorized" });
    }
    console.log("Authorization check PASSED!");

    // Validate reason
    const validReasons = ["venue_closed", "venue_unavailable", "wrong_booking", "user_initiated", "other"];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: "Invalid reason" });
    }

    // Check if there's already an active refund for this booking
    const existingRefund = await Refund.findOne({
      booking: booking._id,
      status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED"] }
    });

    if (existingRefund) {
      return res.status(400).json({ error: "There is already an active refund request for this booking" });
    }

    // Calculate refund amount (full amount for issue-based refunds)
    const refundAmount = amount || booking.paidAmount || 0;

    const refund = await Refund.create({
      booking: bookingId,
      user: booking.user,
      reason,
      description,
      amount: refundAmount,
      convenienceFeeDeducted: 0,
      status: "UNDER_REVIEW"
    });

    res.status(201).json({
      success: true,
      message: "Refund request submitted successfully",
      refund
    });
  } catch (err) {
    console.error("Request Refund Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get Refund Status
// @route   GET /api/refunds/:refundId
// @access  Private
export const getRefundStatus = async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.refundId)
      .populate("booking", "bookingId date startTime turf")
      .populate("processedBy", "name email");

    if (!refund) {
      return res.status(404).json({ error: "Refund not found" });
    }

    // Check ownership or admin
    if (req.user.role !== 'superadmin' && 
        req.user.role !== 'admin' && 
        refund.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    res.json({
      success: true,
      refund
    });
  } catch (err) {
    console.error("Get Refund Status Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Process Refund (Admin Only)
// @route   POST /api/admin/refunds/process
// @access  Private (Admin/Superadmin)
export const processRefund = async (req, res) => {
  try {
    const { refundId, action, rejectionReason, paymentGatewayRefundId } = req.body;
    // action can be "APPROVE" or "REJECT"

    const refund = await Refund.findById(refundId)
      .populate("user", "name email phone fcmToken")
      .populate("booking", "bookingId turf");

    if (!refund) {
      return res.status(404).json({ error: "Refund not found" });
    }

    // Check authorization
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (action === "APPROVE") {
      refund.status = "PROCESSED";
      refund.processedBy = req.user.id;
      refund.processedAt = new Date();
      if (paymentGatewayRefundId) {
        refund.paymentGatewayRefundId = paymentGatewayRefundId;
      }

      // Also update booking payment status
      await Booking.findByIdAndUpdate(refund.booking, { paymentStatus: 'refunded' });
    } else if (action === "REJECT") {
      if (!rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      refund.status = "REJECTED";
      refund.rejectionReason = rejectionReason;
      refund.processedBy = req.user.id;
      refund.processedAt = new Date();
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    await refund.save();

    // Send notification to user
    if (refund.user.fcmToken) {
      const message = action === "APPROVE" 
        ? `Your refund of ₹${refund.amount} has been processed!`
        : `Your refund request has been rejected: ${rejectionReason}`;
      
      sendPushAndSave(
        refund.user._id,
        refund.user.fcmToken,
        action === "APPROVE" ? "Refund Approved!" : "Refund Rejected",
        message,
        "refund_update",
        { refundId: refund._id.toString() }
      ).catch(err => console.error("Notification error:", err));
    }

    res.json({
      success: true,
      message: `Refund ${action.toLowerCase()}ed successfully`,
      refund
    });
  } catch (err) {
    console.error("Process Refund Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get All Refunds (Admin)
// @route   GET /api/admin/refunds
// @access  Private (Admin/Superadmin)
export const getAllRefunds = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const [refunds, totalCount] = await Promise.all([
      Refund.find(query)
        .populate("user", "name email phone")
        .populate("booking", "bookingId date startTime turf")
        .populate("processedBy", "name email")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit)),
      Refund.countDocuments(query)
    ]);

    res.json({
      success: true,
      refunds,
      total: totalCount,
      pages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page)
    });
  } catch (err) {
    console.error("Get All Refunds Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get My Refunds (User)
// @route   GET /api/refunds/my
// @access  Private
export const getMyRefunds = async (req, res) => {
  try {
    const refunds = await Refund.find({ user: req.user.id })
      .populate("booking", "bookingId date startTime turf")
      .sort("-createdAt");

    res.json({
      success: true,
      refunds
    });
  } catch (err) {
    console.error("Get My Refunds Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
