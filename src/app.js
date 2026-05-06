import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import turfRoutes from "./routes/turf.routes.js";
import masterRoutes from "./routes/master.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import tournamentRoutes from "./routes/tournament.routes.js";

const app = express();

// --- Middleware ---
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3005"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// --- Static Files ---
app.use("/uploads", express.static("public/uploads"));

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/turfs", turfRoutes);
app.use("/api/masters", masterRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/tournaments", tournamentRoutes);

export default app;