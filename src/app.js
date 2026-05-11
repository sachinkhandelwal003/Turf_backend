import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import turfRoutes from "./routes/turf.routes.js";
import masterRoutes from "./routes/master.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import tournamentRoutes from "./routes/tournament.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();

// --- Middleware ---
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:3001", 
    "http://localhost:3002", 
    "http://localhost:3003", 
    "http://localhost:3005",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3003",
    "http://127.0.0.1:3005"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// --- Static Files ---
app.use("/uploads", express.static("public/uploads"));

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/turfs", turfRoutes);
app.use("/api/masters", masterRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chat", chatRoutes);

export default app;