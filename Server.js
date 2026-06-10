// 1. THIS MUST BE LINE 1 - It forces dotenv to load before anything else
import 'dotenv/config'; 

// 2. Now we can safely import everything else
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import mongoose from "mongoose";
import { runNotificationScheduler } from "./src/utils/scheduler.js";

// Let's add a quick check to prove it works
console.log("Checking MONGO_URI:", process.env.MONGO_URI ? "Found it!" : "Still undefined 😭");

// 3. Connect to DB
connectDB();

// 4. Start Server
const port = process.env.PORT || 5001;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

import { Server } from "socket.io";
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their notification room: ${socket.id}`);
  });

  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation: ${conversationId}`);
  });

  socket.on("send_message", (data) => {
    // data should contain conversationId, sender, content, etc.
    io.to(data.conversationId).emit("receive_message", data);
  });

  socket.on("delete_message", (data) => {
    io.to(data.conversationId).emit("message_deleted", data.messageId);
  });

  socket.on("react_message", (data) => {
    io.to(data.conversationId).emit("message_reacted", data);
  });
});

// Clean up pending bookings older than 2 minutes every minute
setInterval(async () => {
  try {
    const Booking = mongoose.model("Booking");
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const result = await Booking.updateMany(
      { status: "pending", createdAt: { $lt: twoMinutesAgo } },
      { $set: { status: "cancelled", paymentStatus: "failed" } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Cleanup] Cancelled ${result.modifiedCount} expired pending bookings`);
    }
  } catch (err) {
    console.error("Pending bookings cleanup error:", err);
  }
}, 60 * 1000);

// Run the notification scheduler every minute
setInterval(async () => {
  try {
    await runNotificationScheduler();
  } catch (err) {
    console.error("Notification scheduler interval error:", err);
  }
}, 60 * 1000);