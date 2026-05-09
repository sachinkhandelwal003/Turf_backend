import Review from "../models/review.model.js";
import Booking from "../models/booking.model.js";
import Turf from "../models/turf.model.js";
import User from "../models/auth/user.model.js";

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ error: "Booking ID and rating are required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to review this booking" });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ error: "Can only review completed bookings" });
    }

    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this booking" });
    }

    const review = await Review.create({
      turf: booking.turf,
      booking: bookingId,
      user: req.user.id,
      rating,
      comment,
    });

    await updateTurfRating(booking.turf);

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      review,
    });
  } catch (err) {
    console.error("Create Review Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get reviews for a turf
// @route   GET /api/reviews/turf/:turfId
// @access  Public
export const getTurfReviews = async (req, res) => {
  try {
    const { turfId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      Review.find({ turf: turfId, isApproved: true })
        .populate("user", "name profilePhoto")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit)),
      Review.countDocuments({ turf: turfId, isApproved: true }),
    ]);

    res.json({
      success: true,
      reviews,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Get Turf Reviews Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get all reviews (Admin/Superadmin)
// @route   GET /api/reviews/all
// @access  Private
export const getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", turfId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    if (req.user.role !== "superadmin") {
      const myTurfs = await Turf.find({ owner: req.user.id }).select("_id");
      const myTurfIds = myTurfs.map((t) => t._id);
      query.turf = { $in: myTurfIds };
    }

    if (turfId) {
      query.turf = turfId;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      const users = await User.find({ name: searchRegex }).select("_id");
      const userIds = users.map((u) => u._id);
      query.$or = [
        { user: { $in: userIds } },
        { comment: searchRegex },
      ];
    }

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate("turf", "name")
        .populate("user", "name email profilePhoto")
        .populate("booking", "date startTime endTime")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit)),
      Review.countDocuments(query),
    ]);

    res.json({
      success: true,
      reviews,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Get All Reviews Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Update review approval status
// @route   PATCH /api/reviews/:id/approve
// @access  Private (Admin/Superadmin)
export const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const review = await Review.findById(id).populate("turf");
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (req.user.role !== "superadmin" && review.turf.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    review.isApproved = isApproved;
    await review.save();
    await updateTurfRating(review.turf._id);

    res.json({
      success: true,
      message: `Review ${isApproved ? "approved" : "hidden"} successfully`,
      review,
    });
  } catch (err) {
    console.error("Update Review Status Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Admin/Superadmin)
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id).populate("turf");
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (req.user.role !== "superadmin" && review.turf.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await Review.findByIdAndDelete(id);
    await updateTurfRating(review.turf._id);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (err) {
    console.error("Delete Review Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Helper function to update turf rating
const updateTurfRating = async (turfId) => {
  try {
    const reviews = await Review.find({ turf: turfId, isApproved: true });
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        : 0;

    await Turf.findByIdAndUpdate(turfId, {
      rating: Math.round(averageRating * 10) / 10,
      reviewsCount: totalReviews,
    });
  } catch (err) {
    console.error("Update Turf Rating Error:", err);
  }
};
