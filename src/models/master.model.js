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
  },
  { timestamps: true }
);

// Prevent duplicate names within the same category
masterSchema.index({ name: 1, category: 1 }, { unique: true });

const Master = mongoose.model("Master", masterSchema);

export default Master;
