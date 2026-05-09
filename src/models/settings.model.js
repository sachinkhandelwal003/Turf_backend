import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    default: "Turf Booking",
  },
  contactEmail: {
    type: String,
    default: "",
  },
  frontendLogo: {
    type: String,
    default: "",
  },
  backendLogo: {
    type: String,
    default: "",
  },
  googleLogin: {
    enabled: { type: Boolean, default: false },
    clientId: { type: String, default: "" },
    clientSecret: { type: String, default: "" },
  },
  appleLogin: {
    enabled: { type: Boolean, default: false },
    clientId: { type: String, default: "" },
    teamId: { type: String, default: "" },
    keyId: { type: String, default: "" },
  },
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  coinValue: {
    type: Number,
    default: 1, // 1 coin = ₹1 by default
  },
  heroBanner: {
    title: { type: String, default: "UP YOUR GAME" },
    subtitle: { type: String, default: "Premium sports venues, professional training, and competitive matches. Book your victory in seconds." },
    image: { type: String, default: "/heroimage.png" },
  },
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
