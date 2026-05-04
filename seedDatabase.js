import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/auth/user.model.js";
import Role from "./src/models/auth/role.model.js";
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

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for unified seeding...");

    // Seed a Turf for the test admin
    const testAdminEmail = "testadmin@turf.com";
    const testAdmin = await User.findOne({ email: testAdminEmail });
    
    if (testAdmin) {
      const Turf = (await import("./src/models/turf.model.js")).default;
      const existingTurf = await Turf.findOne({ owner: testAdmin._id });
      
      if (!existingTurf) {
        await Turf.create({
          name: "Elite Box Cricket Arena",
          location: {
            address: "Koramangala 4th Block",
            city: "Bangalore"
          },
          pricePerHour: 1200,
          sports: ["Cricket", "Football"],
          amenities: ["Parking", "Floodlights", "Changing Room"],
          images: ["https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=2067&auto=format&fit=crop"],
          description: "Premium box cricket arena with high-quality turf.",
          owner: testAdmin._id,
          rating: 4.8,
          reviewsCount: 250
        });
        console.log("- Test turf seeded for test admin.");
      }
    }

    // 1. Seed Roles
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
      console.log(`- Role '${roleData.name}' ready.`);
    }

    // 2. Seed Superadmin User
    const superadminEmail = "admin@turf.com";
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    
    console.log("Ensuring superadmin user exists...");
    const superadminData = {
      name: "Super Admin",
      email: superadminEmail,
      phone: "9876543210",
      password: hashedPassword,
      role: "superadmin",
      permissions: allPermissions
    };

    const user = await User.findOneAndUpdate(
      { email: superadminEmail },
      superadminData,
      { upsert: true, new: true }
    );
    console.log(`- Superadmin user '${superadminEmail}' is active.`);

    // 3. Optional: Seed some dummy users for testing
    const dummyUsers = [
      {
        name: "Test Admin",
        email: "testadmin@turf.com",
        phone: "9876543211",
        password: await bcrypt.hash("Admin@123", 10),
        role: "admin",
        permissions: ["view_dashboard", "manage_bookings"]
      },
      {
        name: "Regular User",
        email: "user@turf.com",
        phone: "9876543212",
        password: await bcrypt.hash("User@123", 10),
        role: "user",
        permissions: ["view_profile"]
      }
    ];

    console.log("Seeding test users...");
    for (const userData of dummyUsers) {
      await User.findOneAndUpdate(
        { email: userData.email },
        userData,
        { upsert: true, new: true }
      );
      console.log(`- Test user '${userData.email}' ready.`);
    }

    console.log("\n✅ Database seeding completed successfully!");
    console.log("--------------------------------------------");
    console.log("Admin Login: admin@turf.com / Admin@123");
    console.log("Test Admin: testadmin@turf.com / Admin@123");
    console.log("Test User: user@turf.com / User@123");
    console.log("--------------------------------------------");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during database seeding:", error);
    process.exit(1);
  }
};

seedData();
