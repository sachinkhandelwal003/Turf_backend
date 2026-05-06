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
    courts: [
      {
        type: String, // Name of the court
      }
    ],
    price: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
    convenienceFee: {
      type: Number,
      default: 0,
    },
    paymentStrategy: {
      type: String,
      enum: ["full", "partial"],
      default: "full",
    },
    paymentMethod: {
      type: String,
    },
    splitWithSquad: {
      type: Boolean,
      default: false,
    },
    numberOfPlayers: {
      type: Number,
      default: 1,
    },
    bookingId: {
      type: String,
      unique: true,
      sparse: true,
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

// Prevent double booking for the same turf, date, and time slot for a specific court
bookingSchema.index({ turf: 1, date: 1, startTime: 1, "courts": 1 }, { unique: true });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
