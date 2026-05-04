import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/auth/user.model.js";
import Role from "./src/models/auth/role.model.js";
import Turf from "./src/models/turf.model.js";
import dotenv from "dotenv";

dotenv.config();

const allPermissions = [
  "view_dashboard",
  "manage_users",
  "manage_roles",
  "manage_permissions",
  "view_profile",
  "edit_profile",
  "manage_settings",
  "view_reports",
  "manage_bookings",
  "manage_turfs"
];

const seedMaster = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for Master Seeding...");

    // 1. Clear Existing Data (Optional - use with caution)
    // await User.deleteMany({});
    // await Role.deleteMany({});
    // await Turf.deleteMany({});
    // console.log("Cleared existing data.");

    // 2. Seed Roles
    const rolesToSeed = [
      {
        name: "superadmin",
        permissions: allPermissions
      },
      {
        name: "admin",
        permissions: ["view_dashboard", "view_profile", "edit_profile", "manage_bookings", "manage_turfs"]
      },
      {
        name: "user",
        permissions: ["view_profile", "edit_profile", "view_reports"]
      }
    ];

    console.log("Seeding roles...");
    for (const roleData of rolesToSeed) {
      await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
      console.log(`- Role '${roleData.name}' seeded.`);
    }

    // 3. Seed Users
    const password = await bcrypt.hash("Admin@123", 10);
    const usersToSeed = [
      {
        name: "Super Admin",
        email: "admin@turf.com",
        phone: "9876543210",
        password,
        role: "superadmin",
        permissions: allPermissions,
        isActive: true
      },
      {
        name: "Test Admin",
        email: "testadmin@turf.com",
        phone: "9876543211",
        password,
        role: "admin",
        permissions: ["view_dashboard", "view_profile", "edit_profile", "manage_bookings", "manage_turfs"],
        isActive: true
      },
      {
        name: "Regular User",
        email: "user@turf.com",
        phone: "9876543212",
        password: await bcrypt.hash("User@123", 10),
        role: "user",
        permissions: ["view_profile", "edit_profile"],
        isActive: true
      }
    ];

    console.log("Seeding users...");
    const seededUsers = [];
    for (const userData of usersToSeed) {
      const user = await User.findOneAndUpdate(
        { email: userData.email },
        userData,
        { upsert: true, new: true }
      );
      seededUsers.push(user);
      console.log(`- User '${userData.email}' (${userData.role}) seeded.`);
    }

    // 4. Seed Turfs
    const adminUser = seededUsers.find(u => u.role === "admin" || u.role === "superadmin");
    const turfsToSeed = [
      {
        name: "Elite Box Cricket Arena",
        location: {
          address: "Koramangala 4th Block",
          city: "Bangalore"
        },
        pricePerHour: 1200,
        sports: ["Cricket", "Football"],
        amenities: ["Parking", "Floodlights", "Changing Room", "Drinking Water"],
        images: ["https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=2067&auto=format&fit=crop"],
        description: "Premium box cricket arena with high-quality turf and state-of-the-art floodlights.",
        owner: adminUser._id,
        rating: 4.8,
        reviewsCount: 250,
        isActive: true
      },
      {
        name: "Champions Football Hub",
        location: {
          address: "Indiranagar",
          city: "Bangalore"
        },
        pricePerHour: 1800,
        sports: ["Football"],
        amenities: ["Shower", "Cafeteria", "Floodlights", "Parking"],
        images: ["https://images.unsplash.com/photo-1529900948638-12f99ac43d8b?q=80&w=2070&auto=format&fit=crop"],
        description: "Professional standard football turf for 5-a-side and 7-a-side matches.",
        owner: adminUser._id,
        rating: 4.9,
        reviewsCount: 180,
        isActive: true
      },
      {
        name: "Velocity Padel & Sports",
        location: {
          address: "Whitefield",
          city: "Bangalore"
        },
        pricePerHour: 1500,
        sports: ["Tennis", "Badminton"],
        amenities: ["Air Conditioned", "Equipment Hire", "Parking"],
        images: ["https://images.unsplash.com/photo-1626225967045-9410dd9914b9?q=80&w=2070&auto=format&fit=crop"],
        description: "Multi-sport indoor facility with premium flooring and coaching staff.",
        owner: adminUser._id,
        rating: 4.7,
        reviewsCount: 120,
        isActive: true
      }
    ];

    console.log("Seeding turfs...");
    for (const turfData of turfsToSeed) {
      await Turf.findOneAndUpdate(
        { name: turfData.name },
        turfData,
        { upsert: true, new: true }
      );
      console.log(`- Turf '${turfData.name}' seeded.`);
    }

    console.log("\n✅ Master seeding completed successfully!");
    console.log("--------------------------------------------");
    console.log("Superadmin: admin@turf.com / Admin@123");
    console.log("Admin: testadmin@turf.com / Admin@123");
    console.log("User: user@turf.com / User@123");
    console.log("--------------------------------------------");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Master Seeding Error:", error);
    process.exit(1);
  }
};

seedMaster();
