import mongoose from "mongoose";

const tournamentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    sport: {
      type: String,
      required: true,
    },
    matchType: {
      type: String,
    },
    format: {
      type: String,
    },
    teamSize: {
      type: Number,
    },
    maxSubstitutes: {
      type: Number,
    },
    minPlayers: {
      type: Number,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    registrationDeadline: {
      type: Date,
      required: true,
    },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      venue: { type: String, required: true },
      mapUrl: { type: String },
    },
    crucialDetails: {
      eligibility: { type: String },
      venueGuidelines: { type: String },
      refundPolicy: { type: String },
    },
    entryFee: {
      type: Number,
      default: 0,
    },
    prizePool: {
      type: String,
    },
    prizes: {
      winner: { type: String },
      runnerUp: { type: String },
      others: { type: String },
    },
    rules: [
      { type: String }
    ],
    contact: {
      name: { type: String },
      phone: { type: String },
      email: { type: String },
    },
    maxTeams: {
      type: Number,
    },
    registeredTeams: [
      {
        name: String,
        captain: String,
        contact: String,
        status: { type: String, enum: ["pending", "confirmed", "rejected"], default: "pending" },
      }
    ],
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled", "postponed", "finished"],
      default: "upcoming",
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    image: {
      type: String,
    },
    gallery: [
      { type: String }
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Tournament", tournamentSchema);
