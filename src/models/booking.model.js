import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    turf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Turf",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sport: {
      type: String,
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
    },
    startTime: {
      type: String, // Format: HH:mm
      required: true,
    },
    endTime: {
      type: String, // Format: HH:mm
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Prevent double booking for the same turf, date, and time slot
bookingSchema.index({ turf: 1, date: 1, startTime: 1 }, { unique: true });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
