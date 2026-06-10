import mongoose from "mongoose";
import { sendPushNotification } from "./firebase.js";

export const runNotificationScheduler = async () => {
  try {
    const Booking = mongoose.model("Booking");
    const User = mongoose.model("User");

    const now = new Date();
    const nowMs = now.getTime();

    // Helper to format today as YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const todayStr = formatDate(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    // Find confirmed bookings for today and tomorrow that haven't been notified yet
    const bookings = await Booking.find({
      status: "confirmed",
      date: { $in: [todayStr, tomorrowStr] },
      $or: [
        { notified2HrBefore: false },
        { notified1HrBefore: false },
        { notifiedAtStart: false }
      ]
    }).populate("turf").populate("user");

    for (const booking of bookings) {
      // Parse booking start time
      // booking.date is YYYY-MM-DD, booking.startTime is HH:mm
      const bookingStartStr = `${booking.date}T${booking.startTime}:00`;
      const bookingStart = new Date(bookingStartStr);
      const bookingStartMs = bookingStart.getTime();

      // Time difference in minutes
      const diffMins = (bookingStartMs - nowMs) / (1000 * 60);

      // Case 1: 2 hours before slot reminder (approx 105 to 125 minutes before)
      if (diffMins > 0 && diffMins <= 120 && diffMins > 105 && !booking.notified2HrBefore) {
        if (booking.user && booking.user.fcmToken) {
          await sendPushNotification(
            booking.user.fcmToken,
            "Upcoming Match Reminder! ⚽",
            `Reminder: ₹${booking.balanceAmount} balance is due at ${booking.turf?.name || "the venue"} today at ${booking.startTime}.`,
            { bookingId: booking._id.toString(), type: "reminder_2hr" }
          );
        }
        booking.notified2HrBefore = true;
        await booking.save();
      }

      // Case 2: 1 hour before slot reminder (approx 45 to 65 minutes before)
      if (diffMins > 0 && diffMins <= 60 && diffMins > 45 && !booking.notified1HrBefore) {
        if (booking.user && booking.user.fcmToken) {
          await sendPushNotification(
            booking.user.fcmToken,
            "Last Reminder! ⏰",
            `Last reminder: pay ₹${booking.balanceAmount} to owner before play starts.`,
            { bookingId: booking._id.toString(), type: "reminder_1hr" }
          );
        }
        booking.notified1HrBefore = true;
        await booking.save();
      }

      // Case 3: At slot start reminder (between -15 and 0 minutes from start)
      if (diffMins <= 0 && diffMins >= -15 && !booking.notifiedAtStart) {
        if (booking.turf && booking.turf.owner) {
          const owner = await User.findById(booking.turf.owner);
          if (owner && owner.fcmToken) {
            await sendPushNotification(
              owner.fcmToken,
              "Slot Started! Check Status 🏟️",
              `Did ${booking.user?.name || "User"} arrive and pay balance? Mark Balance Received or No-Show.`,
              { bookingId: booking._id.toString(), type: "slot_start" }
            );
          }
        }
        booking.notifiedAtStart = true;
        await booking.save();
      }
    }
  } catch (err) {
    console.error("Notification scheduler error:", err);
  }
};
