import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/auth/user.model.js";
import Turf from "./src/models/turf.model.js";
import Master from "./src/models/master.model.js";
import dotenv from "dotenv";

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/turf");
    console.log("Connected to MongoDB...");

    // 1. Clear existing data
    await User.deleteMany({});
    await Turf.deleteMany({});
    await Master.deleteMany({});
    console.log("Cleared existing data.");

    // 2. Create Master Data
    const sports = ["Football", "Cricket", "Tennis", "Badminton", "Basketball", "Padel"].map(s => ({ name: s, category: "sport" }));
    const amenities = ["Parking", "Showers", "Changing Room", "Floodlights", "Cafeteria", "Drinking Water"].map(a => ({ name: a, category: "amenity" }));
    const courtTypes = ["Synthetic", "Turf", "Clay", "Hard", "Grass"].map(c => ({ name: c, category: "court_type" }));

    await Master.insertMany([...sports, ...amenities, ...courtTypes]);
    console.log("Created master data.");

    // 3. Create an Admin User
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const adminUser = await User.create({
      name: "Super Admin",
      email: "admin@turf.com",
      phone: "9876543210",
      password: hashedPassword,
      role: "superadmin",
      permissions: ["manage_turfs", "manage_users"]
    });
    console.log("Created admin user.");

    // 3. Create Sample Turfs with updated schema
    const sampleTurfs = [
      {
        name: "Elite Box Cricket Arena",
        location: {
          address: "123 Sports Lane, Koramangala",
          city: "Bangalore",
          landmark: "Near Forum Mall",
          mapUrl: "https://maps.google.com/?q=Elite+Box+Cricket+Arena",
          coordinates: { lat: 12.9352, lng: 77.6245 }
        },
        pricePerHour: 1200,
        rating: 4.8,
        reviewsCount: 250,
        sports: ["Cricket", "Football"],
        amenities: ["Parking", "Drinking Water", "Floodlights"],
        description: "Bangalore's premier multi-sport destination featuring professional-grade turf.",
        images: ["/uploads/sample-turf-1.jpg"],
        operatingHours: [
          { day: "Monday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Tuesday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Wednesday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Thursday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Friday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Saturday", open: "05:00", close: "23:00", isOpen: true },
          { day: "Sunday", open: "05:00", close: "23:00", isOpen: true }
        ],
        availableSlots: [
          { startTime: "06:00", endTime: "07:00", type: "Morning" },
          { startTime: "07:00", endTime: "08:00", type: "Morning" },
          { startTime: "18:00", endTime: "19:00", type: "Evening" }
        ],
        courts: [
          { name: "Main Court", courtType: "Synthetic" }
        ],
        owner: adminUser._id,
        isActive: true
      },
      {
        name: "Velocity Padel & Sports",
        location: {
          address: "Sarjapur Main Road",
          city: "Bangalore",
          landmark: "Opposite Wipro Campus",
          mapUrl: "https://maps.google.com/?q=Velocity+Padel+Sports",
          coordinates: { lat: 12.9100, lng: 77.6800 }
        },
        pricePerHour: 1500,
        rating: 4.5,
        reviewsCount: 120,
        sports: ["Padel", "Tennis", "Badminton"],
        amenities: ["Changing Room", "Showers", "Cafeteria"],
        description: "State-of-the-art padel and tennis courts with premium amenities.",
        images: ["/uploads/sample-turf-2.jpg"],
        operatingHours: [
          { day: "Monday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Tuesday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Wednesday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Thursday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Friday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Saturday", open: "06:00", close: "22:00", isOpen: true },
          { day: "Sunday", open: "06:00", close: "22:00", isOpen: true }
        ],
        availableSlots: [
          { startTime: "08:00", endTime: "09:00", type: "Morning" },
          { startTime: "16:00", endTime: "17:00", type: "Afternoon" },
          { startTime: "18:00", endTime: "19:00", type: "Evening" }
        ],
        courts: [
          { name: "Court 1", courtType: "Clay" },
          { name: "Court 2", courtType: "Hard" }
        ],
        owner: adminUser._id,
        isActive: true
      }
    ];

    await Turf.insertMany(sampleTurfs);
    console.log("Seeded sample turfs.");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
