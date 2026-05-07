import mongoose from "mongoose";
import dotenv from "dotenv";
import Permission from "./src/models/auth/permission.model.js";
import Role from "./src/models/auth/role.model.js";
import User from "./src/models/auth/user.model.js";
import { SYSTEM_PERMISSIONS, SYSTEM_ROLES } from "./src/config/rbac.js";

dotenv.config();

const seedPermissionsAndRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for RBAC seeding...");

    for (const permission of SYSTEM_PERMISSIONS) {
      await Permission.findOneAndUpdate(
        { slug: permission.slug },
        { $set: { ...permission, isActive: true } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    }
    console.log(`Synced ${SYSTEM_PERMISSIONS.length} permissions.`);

    for (const role of SYSTEM_ROLES) {
      await Role.findOneAndUpdate(
        { name: role.name },
        { $set: role },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    }
    console.log(`Synced ${SYSTEM_ROLES.length} roles.`);

    const superadminRole = SYSTEM_ROLES.find((role) => role.name === "superadmin");
    const adminRole = SYSTEM_ROLES.find((role) => role.name === "admin");
    const userRole = SYSTEM_ROLES.find((role) => role.name === "user");

    if (superadminRole) {
      await User.updateMany(
        { role: "superadmin" },
        { $set: { permissions: superadminRole.permissions } }
      );
    }

    if (adminRole) {
      await User.updateMany(
        { role: "admin" },
        { $addToSet: { permissions: { $each: adminRole.permissions } } }
      );
    }

    if (userRole) {
      await User.updateMany(
        { role: "user" },
        { $addToSet: { permissions: { $each: userRole.permissions } } }
      );
    }

    console.log("RBAC seed completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("RBAC seed failed:", error);
    process.exit(1);
  }
};

seedPermissionsAndRoles();
