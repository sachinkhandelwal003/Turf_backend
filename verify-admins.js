import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/auth/user.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const verifyAdmins = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");
    
    // Find all admin and superadmin users
    const admins = await User.find({ 
      $or: [{ role: "admin" }, { role: "superadmin" }] 
    });
    
    console.log(`Found ${admins.length} admin/superadmin users`);
    
    // Verify them all
    const updates = admins.map(async (admin) => {
      if (!admin.isVerified) {
        admin.isVerified = true;
        await admin.save();
        console.log(`Verified admin: ${admin.name} (${admin.email})`);
      } else {
        console.log(`Admin already verified: ${admin.name} (${admin.email})`);
      }
    });
    
    await Promise.all(updates);
    
    await mongoose.disconnect();
    console.log("Done!");
  } catch (err) {
    console.error("Error:", err);
  }
};

verifyAdmins();
