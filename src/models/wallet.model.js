import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for quick lookup
walletSchema.index({ admin: 1 });

const Wallet = mongoose.model("Wallet", walletSchema);

export default Wallet;
