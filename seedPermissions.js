import mongoose from "mongoose";
import Role from "./src/models/auth/role.model.js";
import User from "./src/models/auth/user.model.js";
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

const seedRBAC = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for RBAC seeding...");

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

    for (const roleData of rolesToSeed) {
      await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
      console.log(`Role '${roleData.name}' seeded.`);
    }

    // 2. Update existing Superadmin User
    const superadminEmail = "admin@turf.com";
    const superadmin = await User.findOne({ email: superadminEmail });

    if (superadmin) {
      superadmin.permissions = allPermissions;
      superadmin.role = "superadmin";
      await superadmin.save();
      console.log(`Updated permissions for superadmin: ${superadminEmail}`);
    } else {
      console.log("Superadmin user not found. Please run seedAdmin.js first.");
    }

    console.log("RBAC seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding RBAC:", error);
    process.exit(1);
  }
};

seedRBAC();
