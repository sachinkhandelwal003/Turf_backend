import mongoose from "mongoose";

const venueLeadSchema = new mongoose.Schema(
  {
    groundName: {
      type: String,
      required: true,
      trim: true,
    },
    turfName: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    photos: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "contacted", "converted", "rejected"],
      default: "pending",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("VenueLead", venueLeadSchema);
