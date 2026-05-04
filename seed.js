import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./src/models/auth/user.model.js";
import Role from "./src/models/auth/role.model.js";
import Master from "./src/models/master.model.js";
import Turf from "./src/models/turf.model.js";

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for unified seeding...");

    // 1. Clear existing data
    console.log("Cleaning database...");
    await Promise.all([
      User.deleteMany({}),
      Role.deleteMany({}),
      Master.deleteMany({}),
      Turf.deleteMany({})
    ]);

    // 2. Seed Roles
    console.log("Seeding roles...");
    const roles = await Role.insertMany([
      { name: "superadmin", permissions: ["all"], description: "System owner with full access" },
      { name: "admin", permissions: ["manage_turfs", "manage_users"], description: "Venue owner/manager" },
      { name: "user", permissions: ["view_turfs", "book_turf"], description: "Standard customer" }
    ]);

    // 3. Seed Admin User
    console.log("Seeding admin user...");
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    const admin = await User.create({
      name: "Super Admin",
      email: "admin@turf.com",
      phone: "9876543210",
      password: hashedPassword,
      role: "superadmin",
      permissions: ["all"],
      isActive: true
    });

    // 4. Seed Masters (Sports & Amenities)
    console.log("Seeding masters...");
    await Master.insertMany([
      { name: "Football", category: "sport", isActive: true },
      { name: "Cricket", category: "sport", isActive: true },
      { name: "Tennis", category: "sport", isActive: true },
      { name: "Badminton", category: "sport", isActive: true },
      { name: "Basketball", category: "sport", isActive: true },
      { name: "Padel", category: "sport", isActive: true },
      { name: "Parking", category: "amenity", isActive: true },
      { name: "Showers", category: "amenity", isActive: true },
      { name: "Floodlights", category: "amenity", isActive: true },
      { name: "Cafeteria", category: "amenity", isActive: true },
      { name: "Locker Room", category: "amenity", isActive: true },
      { name: "Synthetic", category: "court_type", isActive: true },
      { name: "Clay", category: "court_type", isActive: true },
      { name: "Grass", category: "court_type", isActive: true }
    ]);

    // 5. Seed 3 Venues
    console.log("Seeding venues...");
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    await Turf.insertMany([
      {
        name: "Elite Box Cricket Arena",
        location: {
          address: "Koramangala 5th Block, Bengaluru, Karnataka 560034",
          city: "Bangalore",
          landmark: "Near Central Mall"
        },
        pricePerHour: 1200,
        sports: ["Cricket"],
        amenities: ["Parking", "Showers", "Floodlights"],
        description: "Premium box cricket arena featuring high-quality turf and excellent floodlights for night matches. Perfect for corporate tournaments and friendly weekend games.",
        images: ["/Elitebox.png"],
        rating: 4.8,
        reviewsCount: 342,
        owner: admin._id,
        isActive: true,
        operatingHours: days.map(day => ({ day, open: "06:00", close: "23:00", isOpen: true })),
        courts: [{ name: "Main Court", courtType: "Synthetic" }]
      },
      {
        name: "Champions Football Hub",
        location: {
          address: "100ft Road, Indiranagar, Bengaluru, Karnataka 560038",
          city: "Bangalore",
          landmark: "Opposite Metro Station"
        },
        pricePerHour: 1800,
        sports: ["Football"],
        amenities: ["Parking", "Showers", "Cafeteria", "Locker Room"],
        description: "Professional grade football turf with FIFA standard artificial grass. Hosts multiple local leagues and is equipped with a cafeteria for post-match refreshments.",
        images: ["/hub.png"],
        rating: 4.9,
        reviewsCount: 512,
        owner: admin._id,
        isActive: true,
        operatingHours: days.map(day => ({ day, open: "05:00", close: "00:00", isOpen: true })),
        courts: [{ name: "Field A", courtType: "Grass" }]
      },
      {
        name: "Velocity Padel & Sports",
        location: {
          address: "Whitefield Main Road, Bengaluru, Karnataka 560066",
          city: "Bangalore",
          landmark: "Next to IT Park"
        },
        pricePerHour: 1500,
        sports: ["Padel", "Tennis"],
        amenities: ["Parking", "Floodlights", "Cafeteria"],
        description: "State-of-the-art indoor sports facility with temperature control. Best place to play Padel and Tennis in any weather.",
        images: ["/velocity.png"],
        rating: 4.7,
        reviewsCount: 128,
        owner: admin._id,
        isActive: true,
        operatingHours: days.map(day => ({ day, open: "06:00", close: "22:00", isOpen: true })),
        courts: [{ name: "Padel Court 1", courtType: "Synthetic" }]
      }
    ]);

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
