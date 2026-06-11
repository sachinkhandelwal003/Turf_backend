import cron from 'node-cron';
import Booking from '../models/booking.model.js';
import User from '../models/auth/user.model.js';
import Turf from '../models/turf.model.js';
import { sendPushAndSave } from './firebase.js';
import { sendEmail } from './email.js';

// 🔔 Function to send booking reminders
const sendBookingReminders = async () => {
  try {
    console.log('⏰ Checking for upcoming bookings to send reminders...');
    
    // Get current time and calculate reminder windows
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Parse HH:MM to total minutes
    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const currentMinutes = timeToMinutes(currentTime);

    // Find all confirmed bookings for today and future
    const bookings = await Booking.find({
      status: 'confirmed',
      date: { $gte: today }
    }).populate('user', 'name email fcmToken')
      .populate('turf', 'name owner');

    for (const booking of bookings) {
      if (!booking.user || !booking.turf) continue;

      const bookingDate = new Date(booking.date);
      const bookingDateStr = bookingDate.toISOString().split('T')[0];
      const startMinutes = timeToMinutes(booking.startTime);
      
      // Calculate time difference in minutes
      let diffMinutes = 0;
      
      if (bookingDateStr === today) {
        diffMinutes = startMinutes - currentMinutes;
      } else {
        // For future dates, calculate total minutes difference
        const diffMs = bookingDate - now;
        diffMinutes = Math.floor(diffMs / (1000 * 60)) + startMinutes;
      }

      // 🔹 2 HOUR REMINDER
      if (diffMinutes >= 118 && diffMinutes <= 122) { // ±2 minutes window
        if (!booking.reminderSent2hr) {
          if (booking.user.fcmToken) {
            sendPushAndSave(
              booking.user._id,
              booking.user.fcmToken,
              'Reminder: Your Booking is in 2 Hours! ⏰',
              `Don't forget your ${booking.turf.name} booking at ${booking.startTime}!`,
              'booking_reminder',
              { bookingId: booking._id.toString(), reminderType: '2hr' }
            ).catch(err => console.error('2hr reminder error:', err));
          }

          if (booking.user.email) {
            sendEmail({
              email: booking.user.email,
              subject: 'Reminder: Your Booking is in 2 Hours!',
              message: `Hi ${booking.user.name},\n\nJust a reminder that your booking at ${booking.turf.name} starts in 2 hours (${booking.startTime}).`,
              html: `<p>Hi ${booking.user.name},</p><p>Just a reminder that your booking at <strong>${booking.turf.name}</strong> starts in 2 hours (${booking.startTime}).</p>`
            }).catch(err => console.error('2hr email error:', err));
          }

          booking.reminderSent2hr = true;
          await booking.save();
          console.log(`✅ Sent 2hr reminder for booking ${booking._id}`);
        }
      }

      // 🔹 1 HOUR REMINDER
      if (diffMinutes >= 58 && diffMinutes <= 62) {
        if (!booking.reminderSent1hr) {
          if (booking.user.fcmToken) {
            sendPushAndSave(
              booking.user._id,
              booking.user.fcmToken,
              'Reminder: Your Booking is in 1 Hour! ⏰',
              `Your ${booking.turf.name} booking starts soon at ${booking.startTime}!`,
              'booking_reminder',
              { bookingId: booking._id.toString(), reminderType: '1hr' }
            ).catch(err => console.error('1hr reminder error:', err));
          }

          if (booking.user.email) {
            sendEmail({
              email: booking.user.email,
              subject: 'Reminder: Your Booking is in 1 Hour!',
              message: `Hi ${booking.user.name},\n\nReminder: your booking at ${booking.turf.name} starts in 1 hour (${booking.startTime}).`,
              html: `<p>Hi ${booking.user.name},</p><p>Reminder: your booking at <strong>${booking.turf.name}</strong> starts in 1 hour (${booking.startTime}).</p>`
            }).catch(err => console.error('1hr email error:', err));
          }

          booking.reminderSent1hr = true;
          await booking.save();
          console.log(`✅ Sent 1hr reminder for booking ${booking._id}`);
        }
      }

      // 🔹 SLOT START REMINDER (FOR OWNER)
      if (diffMinutes >= -2 && diffMinutes <= 2) {
        if (!booking.ownerReminderSent) {
          const owner = await User.findById(booking.turf.owner);
          if (owner?.fcmToken) {
            sendPushAndSave(
              owner._id,
              owner.fcmToken,
              'Booking Starting Now! 🏟️',
              `${booking.user.name}'s booking at ${booking.turf.name} is starting now!`,
              'booking_start',
              { bookingId: booking._id.toString() }
            ).catch(err => console.error('Owner start reminder error:', err));
          }

          booking.ownerReminderSent = true;
          await booking.save();
          console.log(`✅ Sent owner start reminder for booking ${booking._id}`);
        }
      }
    }

  } catch (err) {
    console.error('❌ Error in reminder scheduler:', err);
  }
};

// 🕒 Start scheduler - runs every minute
const startReminderScheduler = () => {
  cron.schedule('* * * * *', sendBookingReminders);
  console.log('✅ Reminder scheduler started!');
};

export default startReminderScheduler;
