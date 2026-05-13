import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["payout", "recovery"], // payout: we pay to owner, recovery: owner pays to us
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      default: "UPI",
    },
    transactionId: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    settledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Settlement", settlementSchema);
