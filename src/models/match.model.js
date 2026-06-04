import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    turf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Turf",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    sport: {
      type: String,
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
    },
    startTime: {
      type: String, // Format: HH:mm
      required: true,
    },
    endTime: {
      type: String, // Format: HH:mm
      required: true,
    },
    totalPlayersNeeded: {
      type: Number,
      required: true,
      min: 1,
    },
    joinedPlayers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "confirmed", "cancelled"],
          default: "confirmed",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    pricePerPlayer: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["open", "full", "cancelled", "completed", "cancelled hosting"],
      default: "open",
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Match = mongoose.model("Match", matchSchema);
export default Match;
