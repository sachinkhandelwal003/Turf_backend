import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/auth/user.model.js";
import dotenv from "dotenv";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    const adminEmail = "admin@turf.com";
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log("Admin user already exists.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    const adminUser = new User({
      name: "Super Admin",
      email: adminEmail,
      phone: "9876543210",
      password: hashedPassword,
      role: "superadmin",
      permissions: ["all"],
    });

    await adminUser.save();
    console.log("Admin user created successfully!");
    console.log("Email: admin@turf.com");
    console.log("Password: Admin@123");
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
