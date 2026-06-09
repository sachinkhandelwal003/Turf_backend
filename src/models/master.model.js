import mongoose from "mongoose";

const masterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["sport", "amenity", "court_type"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    image: {
      type: String,
      default: "",
    },
    // For sports category: number of players per team/side (e.g. 11 for Cricket, 2 for Tennis)
    playerCount: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate names within the same category
masterSchema.index({ name: 1, category: 1 }, { unique: true });

const Master = mongoose.model("Master", masterSchema);

export default Master;
