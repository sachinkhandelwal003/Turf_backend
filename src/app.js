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
import billingRoutes from "./routes/billing.routes.js";
import venueLeadRoutes from "./routes/venueLead.routes.js";
import settlementRoutes from "./routes/settlement.routes.js";
import matchRoutes from "./routes/match.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

// --- Middleware ---
const allowedOrigins = [
  "http://localhost:3000", 
  "http://localhost:3001", 
  "http://localhost:3002", 
  "http://localhost:3003", 
  "http://localhost:3005",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3003",
  "http://127.0.0.1:3005",
  "https://gameonindia.tech",
  "http://gameonindia.tech",
  "http://145.223.21.134"
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
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
app.use("/api/billing", billingRoutes);
app.use("/api/venue-leads", venueLeadRoutes);
app.use("/api/settlements", settlementRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/notifications", notificationRoutes);

// --- Error Handler ---
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR HANDLER:", err);
  
  // Handle Multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      msg: `Upload Error: ${err.message}`
    });
  }

  // Handle custom errors (like our file filter error)
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    msg: err.message || "Internal Server Error"
  });
});

export default app;