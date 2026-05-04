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
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
