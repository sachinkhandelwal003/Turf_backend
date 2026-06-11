import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "welcome",
        "login_alert",
        "booking_confirmed",
        "new_booking",
        "booking_reminder",
        "booking_start",
        "new_match",
        "other"
      ],
      default: "other",
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index to get user's notifications quickly
notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
