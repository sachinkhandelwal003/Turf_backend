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
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check ownership
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if booking is already cancelled or completed
    if (booking.status === 'cancelled' || booking.status === 'completed') {
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
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Cancel Booking (with new policy)
// @route   POST /api/bookings/:bookingId/cancel
// @access  Private
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

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

    const hoursUntilBooking = getHoursUntilBooking(booking);
    const refundData = calculateRefund(booking, hoursUntilBooking);

    // Update booking status and cancellation details
    booking.status = 'cancelled';
    booking.cancellationDetails = {
      category: refundData.category,
      hoursUntilBooking: refundData.hoursUntilBooking,
      refundAmount: refundData.refundAmount,
      ownerKeepsAmount: refundData.ownerKeepsAmount,
      adminKeepsAmount: refundData.adminKeepsAmount,
      policyNote: refundData.policyNote
    };
    await booking.save();

    // If payment was made, create a refund request automatically
    if (booking.paymentStatus === 'paid' && booking.paidAmount > 0) {
      // Create automatic refund request (user-initiated)
      await Refund.create({
        booking: booking._id,
        user: booking.user,
        reason: "user_initiated",
        description: refundData.policyNote,
        amount: refundData.refundAmount,
        status: refundData.refundAmount > 0 ? "PENDING" : "PROCESSED"
      });
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
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Request a Refund (for venue issues etc.)
// @route   POST /api/refunds/request
// @access  Private
export const requestRefund = async (req, res) => {
  try {
    const { bookingId, reason, description } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check ownership
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Validate reason
    const validReasons = ["venue_closed", "venue_unavailable", "wrong_booking", "other"];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: "Invalid reason" });
    }

    // Check if there's already an active refund for this booking
    const existingRefund = await Refund.findOne({
      booking: bookingId,
      status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED"] }
    });

    if (existingRefund) {
      return res.status(400).json({ error: "There is already an active refund request for this booking" });
    }

    // Calculate refund amount (full amount for issue-based refunds)
    const refundAmount = booking.paidAmount;

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
