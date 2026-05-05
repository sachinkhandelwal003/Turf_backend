import mongoose from "mongoose";

const turfSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      landmark: { type: String },
      mapUrl: { type: String },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    pricePerHour: {
      type: Number,
      required: true,
    },
    rates: [
      {
        day: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
        price: Number,
        isPeak: { type: Boolean, default: false },
      }
    ],
    operatingHours: [
      {
        day: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
        open: String, // e.g., "06:00"
        close: String, // e.g., "22:00"
        isOpen: { type: Boolean, default: true }
      }
    ],
    availableSlots: [
      {
        startTime: String, // e.g., "06:00"
        endTime: String,   // e.g., "07:00"
        type: { type: String, enum: ["Morning", "Afternoon", "Evening"] }
      }
    ],
    courts: [
      {
        name: { type: String },
        courtType: { type: String },
      }
    ],
    unavailableDates: [
      {
        date: Date,
        reason: String
      }
    ],
    sports: {
      type: [String],
      enum: ["Football", "Cricket", "Tennis", "Badminton", "Basketball", "Padel"],
    },
    amenities: [String],
    images: [String],
    description: {
      type: String,
    },
    rating: {
      type: Number,
      default: 0,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Turf", turfSchema);
