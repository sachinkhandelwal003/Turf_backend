import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Refund from "../models/refund.model.js";
import Settings from "../models/settings.model.js";
import Turf from "../models/turf.model.js";
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
    console.log("Req user id:", req.user.id, "Type:", typeof req.user.id);

    // Check ownership OR admin/owner role
    const bookingUserId = booking.user.toString();
    const requestUserId = req.user.id;
    const userRole = req.user.role || 'user';
    
    console.log("Comparing - Booking user:", bookingUserId, "Req user:", requestUserId, "User role:", userRole, "Match?", bookingUserId === requestUserId || ["admin", "superadmin"].includes(userRole));
    
    if (!(bookingUserId === requestUserId || ["admin", "superadmin"].includes(userRole))) {
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
      booking = await Booking.findById(bookingIdParam).populate('turf');
    }
    
    // If not found or not ObjectId, try by bookingId
    if (!booking) {
      console.log("Trying to find by bookingId:", bookingIdParam);
      booking = await Booking.findOne({ bookingId: bookingIdParam }).populate('turf');
    }

    if (!booking) {
      console.log("Booking not found at all for:", req.params.bookingId);
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("Found booking for cancel:", booking._id, booking.bookingId);
    console.log("Booking user (raw):", booking.user, "Type:", typeof booking.user);
    console.log("Req user:", req.user);
    console.log("Req user id:", req.user.id, "Type:", typeof req.user.id);

    // Check ownership
    const bookingUserId = booking.user.toString();
    const requestUserId = req.user.id;
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
      const refundDataToCreate = {
        booking: booking._id,
        user: booking.user,
        admin: booking.turf?.owner, // Set turf owner as admin (safe access)
        reason: "user_initiated",
        description: refundData.policyNote,
        amount: refundData.refundAmount,
        status: refundData.refundAmount > 0 ? "PENDING" : "PROCESSED"
      };
      
      // If upiDetails are provided in req.body, add them safely
      if (req.body && req.body.upiDetails) {
        refundDataToCreate.upiDetails = {
          upiId: req.body.upiDetails.upiId || "",
          upiName: req.body.upiDetails.upiName || "",
          upiNote: req.body.upiDetails.upiNote || ""
        };
      }
      
      // If userInfo is provided in req.body, add it
      if (req.body && req.body.userInfo) {
        refundDataToCreate.userInfo = {
          name: req.body.userInfo.name || "",
          phone: req.body.userInfo.phone || "",
          email: req.body.userInfo.email || ""
        };
      }
      
      const refund = await Refund.create(refundDataToCreate);
      console.log("Refund request created successfully:", refund._id);
      
      // Send the refund in response as well
      res.locals.refund = refund;
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

    const responseData = {
      success: true,
      message: "Booking cancelled successfully",
      booking
    };
    
    // If we created a refund, include it in the response
    if (res.locals.refund) {
      responseData.refund = res.locals.refund;
    }
    
    res.json(responseData);
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
    
    const { bookingId: bookingIdParam, reason, description, amount } = req.body;
    
    // Try to find by _id first (if it looks like ObjectId), then by bookingId
    let booking;
    
    if (/^[0-9a-fA-F]{24}$/.test(bookingIdParam)) {
      console.log("Trying to find by _id:", bookingIdParam);
      booking = await Booking.findById(bookingIdParam).populate('turf');
    }
    
    if (!booking) {
      console.log("Trying to find by bookingId:", bookingIdParam);
      booking = await Booking.findOne({ bookingId: bookingIdParam }).populate('turf');
    }

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("Found booking for refund request:", booking._id, booking.bookingId);

    // Check ownership OR admin/owner role
    const bookingUserId = booking.user.toString();
    const requestUserId = req.user.id.toString();
    const userRole = req.user.role;
    
    console.log("Comparing - Booking user:", bookingUserId, "Req user:", requestUserId, "User role:", userRole, "Match?", bookingUserId === requestUserId || ["admin", "superadmin"].includes(userRole));
    
    if (!(bookingUserId === requestUserId || ["admin", "superadmin"].includes(userRole))) {
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
      booking: booking._id,
      user: booking.user,
      admin: booking.turf?.owner, // Set the turf owner as admin (safe access)
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

// @desc    Get Refunds for Admin
// @route   GET /api/refunds/admin
// @access  Private (Admin/Superadmin)
export const getRefundsByAdmin = async (req, res) => {
  try {
    console.log("=== START getRefundsByAdmin ===");
    console.log("req.user exists?", !!req.user);
    console.log("req.user.id:", req.user?._id);
    console.log("req.user.role (raw):", req.user?.role);
    
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log("Query params:", { page, limit, status });
    
    let query = {};
    
    // Only filter by admin if user is not superadmin
    const userRole = req.user?.role || 'user';
    if (userRole !== 'superadmin') {
      console.log("Not superadmin, filtering for admin's refunds");
      
      // Find all turfs owned by this admin
      const adminTurfs = await Turf.find({ owner: req.user.id }).select('_id');
      const turfIds = adminTurfs.map(t => t._id);
      console.log("Admin's turf IDs:", turfIds);
      
      // Find all bookings for these turfs
      const adminBookings = await Booking.find({ turf: { $in: turfIds } }).select('_id');
      const bookingIds = adminBookings.map(b => b._id);
      console.log("Admin's booking IDs:", bookingIds);
      
      // Build query: refunds where admin is user OR booking is in admin's bookings
      query.$or = [
        { admin: req.user.id },
        { booking: { $in: bookingIds } }
      ];
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      if (query.$or) {
        query = {
          $and: [
            { $or: query.$or },
            { status }
          ]
        };
      } else {
        query.status = status;
      }
    }

    console.log("Final Query:", JSON.stringify(query, null, 2));

    console.log("Fetching refunds...");
    const [refunds, totalCount] = await Promise.all([
      Refund.find(query)
        .lean()
        .populate({
          path: 'user',
          select: 'name email phone',
          strictPopulate: false
        })
        .populate({ 
          path: 'booking', 
          select: 'bookingId date startTime turf',
          populate: { 
            path: 'turf', 
            select: 'name location',
            strictPopulate: false 
          },
          strictPopulate: false
        })
        .populate({
          path: 'processedBy',
          select: 'name email',
          strictPopulate: false
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Refund.countDocuments(query)
    ]);

    console.log("✅ SUCCESS: Fetched refunds");
    console.log("Refunds count:", refunds.length);
    console.log("Total count:", totalCount);

    res.json({
      success: true,
      refunds,
      total: totalCount,
      pages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page)
    });
  } catch (err) {
    console.error("❌ getRefundsByAdmin ERROR");
    console.error("Error stack:", err.stack);
    console.error("Error message:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to load refunds",
      details: err.message
    });
  }
};

// @desc    Submit UPI Details for Refund
// @route   POST /api/refunds/:refundId/upi
// @access  Private
export const submitUPIDetails = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { upiId, upiName, upiNote } = req.body;
    
    const refund = await Refund.findById(refundId);
    
    if (!refund) {
      return res.status(404).json({ error: "Refund not found" });
    }
    
    // Check if user is the owner of the refund or admin
    if (refund.user.toString() !== req.user.id.toString() && 
        !["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    // Update UPI details
    refund.upiDetails = {
      upiId,
      upiName,
      upiNote
    };
    
    await refund.save();
    
    res.json({
      success: true,
      message: "UPI details submitted successfully",
      refund
    });
  } catch (err) {
    console.error("Submit UPI Details Error:", err);
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
        refund.user.toString() !== req.user.id.toString()) {
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
      .populate({
        path: "booking",
        populate: {
          path: "turf"
        }
      });

    if (!refund) {
      return res.status(404).json({ error: "Refund not found" });
    }

    // Check authorization
    if (req.user.role !== 'superadmin') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Verify the admin owns the turf associated with this booking
      const turfOwner = refund.booking?.turf?.owner?.toString();
      const userId = req.user.id.toString();

      if (turfOwner !== userId) {
        return res.status(403).json({ error: "Not authorized: You do not own the turf associated with this booking" });
      }
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
    if (refund.user && refund.user.fcmToken) {
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

    const userRole = req.user?.role || 'user';
    if (userRole !== 'superadmin') {
      // Find all turfs owned by this admin
      const adminTurfs = await Turf.find({ owner: req.user.id }).select('_id');
      const turfIds = adminTurfs.map(t => t._id);
      
      // Find all bookings for these turfs
      const adminBookings = await Booking.find({ turf: { $in: turfIds } }).select('_id');
      const bookingIds = adminBookings.map(b => b._id);
      
      const orFilter = [
        { admin: req.user.id },
        { booking: { $in: bookingIds } }
      ];

      if (query.status) {
        query = {
          $and: [
            { status: query.status },
            { $or: orFilter }
          ]
        };
      } else {
        query.$or = orFilter;
      }
    }

    const [refunds, totalCount] = await Promise.all([
      Refund.find(query)
        .populate("user", "name email phone")
        .populate({ 
          path: "booking", 
          select: "bookingId date startTime turf",
          populate: { path: "turf", select: "name location" }
        })
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
      .populate({ 
        path: "booking", 
        select: "bookingId date startTime turf",
        populate: { path: "turf", select: "name location" }
      })
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
