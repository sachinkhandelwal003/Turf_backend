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

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;
