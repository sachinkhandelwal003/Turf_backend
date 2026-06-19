import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reason: {
      type: String,
      enum: [
        "venue_closed",
        "venue_unavailable",
        "wrong_booking",
        "user_initiated",
        "other"
      ],
      required: true,
    },
    description: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    convenienceFeeDeducted: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "PROCESSED"
      ],
      default: "PENDING",
    },
    upiDetails: {
      upiId: { type: String },
      upiName: { type: String },
      upiNote: { type: String }
    },
    userInfo: {
      name: { type: String },
      phone: { type: String },
      email: { type: String }
    },
    rejectionReason: {
      type: String,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
    paymentGatewayRefundId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
refundSchema.index({ admin: 1, createdAt: -1 });
refundSchema.index({ user: 1, createdAt: -1 });

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;
