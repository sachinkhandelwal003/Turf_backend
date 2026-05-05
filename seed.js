import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./src/models/auth/user.model.js";
import Role from "./src/models/auth/role.model.js";
import Permission from "./src/models/auth/permission.model.js";
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
      Permission.deleteMany({}),
      Master.deleteMany({}),
      Turf.deleteMany({})
    ]);

    // 1.5 Seed Permissions
    console.log("Seeding permissions...");
    const systemPermissions = [
      { name: "View Dashboard", slug: "view_dashboard", description: "Access to admin dashboard" },
      { name: "Manage Users", slug: "manage_users", description: "Create, edit, and delete users" },
      { name: "Manage Roles", slug: "manage_roles", description: "Create and edit system roles" },
      { name: "Manage Permissions", slug: "manage_permissions", description: "Manage system permissions" },
      { name: "Manage Settings", slug: "manage_settings", description: "Change system settings" },
      { name: "Manage Masters", slug: "manage_masters", description: "Manage sports, amenities, and court types" },
      { name: "Manage Turfs", slug: "manage_turfs", description: "Full access to turf management" },
      { name: "View Venues", slug: "view_venues", description: "View list of venues" },
      { name: "Add Venue", slug: "add_venue", description: "Add new venues" },
      { name: "Edit Venue", slug: "edit_venue", description: "Edit existing venues" }
    ];
    await Permission.insertMany(systemPermissions);

    // 2. Seed Roles
    console.log("Seeding roles...");
    const roles = await Role.insertMany([
      { name: "superadmin", permissions: ["all"], description: "System owner with full access" },
      {
        name: "admin",
        permissions: [
          "view_dashboard",
          "view_venues",
          "add_venue",
          "edit_venue",
          "manage_turfs"
        ],
        description: "Venue owner/manager"
      },
      { name: "user", permissions: ["view_turfs", "book_turf"], description: "Standard customer" }
    ]);

    // 3. Seed Users
    console.log("Seeding users...");
    const hashedAdminPassword = await bcrypt.hash("Admin@123", 10);
    const hashedUserPassword = await bcrypt.hash("User@123", 10);

    // 3.1 Super Admin
    const superadmin = await User.create({
      name: "Super Admin",
      email: "admin@turf.com",
      phone: "9876543210",
      password: hashedAdminPassword,
      role: "superadmin",
      permissions: ["all"],
      isActive: true,
      profilePhoto: "https://i.pravatar.cc/150?u=admin@turf.com"
    });
    superadmin.createdBy = superadmin._id;
    await superadmin.save();

    // 3.2 Turf Owner 1 (Admin)
    const owner1 = await User.create({
      name: "Sourabh Turf Owner",
      email: "owner1@turf.com",
      phone: "9988776655",
      password: hashedAdminPassword,
      role: "admin",
      permissions: ["view_dashboard", "view_venues", "add_venue", "edit_venue", "manage_turfs"],
      isActive: true,
      createdBy: superadmin._id,
      profilePhoto: "https://i.pravatar.cc/150?u=owner1@turf.com"
    });

    // 3.3 Turf Owner 2 (Admin)
    const owner2 = await User.create({
      name: "Surbhi Venue Manager",
      email: "owner2@turf.com",
      phone: "8877665544",
      password: hashedAdminPassword,
      role: "admin",
      permissions: ["view_dashboard", "view_venues", "add_venue", "edit_venue", "manage_turfs"],
      isActive: true,
      createdBy: superadmin._id,
      profilePhoto: "https://i.pravatar.cc/150?u=owner2@turf.com"
    });

    // 3.4 Regular Users
    await User.create([
      {
        name: "Rahul Customer",
        email: "rahul@gmail.com",
        phone: "7766554433",
        password: hashedUserPassword,
        role: "user",
        permissions: [],
        isActive: true,
        createdBy: superadmin._id,
        profilePhoto: "https://i.pravatar.cc/150?u=rahul@gmail.com"
      },
      {
        name: "Pooja Player",
        email: "pooja@gmail.com",
        phone: "6655443322",
        password: hashedUserPassword,
        role: "user",
        permissions: [],
        isActive: true,
        createdBy: owner1._id,
        profilePhoto: "https://i.pravatar.cc/150?u=pooja@gmail.com"
      }
    ]);

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
          landmark: "Near Central Mall",
          mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.48148825838!2d77.61864117507593!3d12.93459521555568!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae144e3391d3e1%3A0xc547348983995f5!2sKoramangala%205th%20Block%2C%20Koramangala%2C%20Bengaluru%2C%20Karnataka!5e0!3m2!1sen!2sin!4v1714896000000!5m2!1sen!2sin"
        },
        pricePerHour: 1200,
        sports: ["Cricket"],
        amenities: ["Parking", "Showers", "Floodlights"],
        description: "Premium box cricket arena featuring high-quality turf and excellent floodlights for night matches. Perfect for corporate tournaments and friendly weekend games.",
        images: ["/Elitebox.png"],
        rating: 4.8,
        reviewsCount: 342,
        owner: owner1._id,
        isActive: true,
        operatingHours: days.map(day => ({ day, open: "06:00", close: "23:00", isOpen: true })),
        courts: [{ name: "Main Court", courtType: "Synthetic" }]
      },
      {
        name: "Champions Football Hub",
        location: {
          address: "100ft Road, Indiranagar, Bengaluru, Karnataka 560038",
          city: "Bangalore",
          landmark: "Opposite Metro Station",
          mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.892055620173!2d77.6385848!3d12.9718915!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae16a6bb6059c1%3A0x6338575a6c3f309d!2sIndiranagar%2C%20Bengaluru%2C%20Karnataka!5e0!3m2!1sen!2sin!4v1714896000000!5m2!1sen!2sin"
        },
        pricePerHour: 1800,
        sports: ["Football"],
        amenities: ["Parking", "Showers", "Cafeteria", "Locker Room"],
        description: "Professional grade football turf with FIFA standard artificial grass. Hosts multiple local leagues and is equipped with a cafeteria for post-match refreshments.",
        images: ["/hub.png"],
        rating: 4.9,
        reviewsCount: 512,
        owner: owner2._id,
        isActive: true,
        operatingHours: days.map(day => ({ day, open: "05:00", close: "00:00", isOpen: true })),
        courts: [{ name: "Field A", courtType: "Grass" }]
      },
      {
        name: "Velocity Padel & Sports",
        location: {
          address: "Whitefield Main Road, Bengaluru, Karnataka 560066",
          city: "Bangalore",
          landmark: "Next to IT Park",
          mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.000000000000!2d77.7500000!3d12.9666667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae11f32a792f7b%3A0x6b48858f625026b4!2sWhitefield%2C%20Bengaluru%2C%20Karnataka!5e0!3m2!1sen!2sin!4v1714896000000!5m2!1sen!2sin"
        },
        pricePerHour: 1500,
        sports: ["Padel", "Tennis"],
        amenities: ["Parking", "Floodlights", "Cafeteria"],
        description: "State-of-the-art indoor sports facility with temperature control. Best place to play Padel and Tennis in any weather.",
        images: ["/velocity.png"],
        rating: 4.7,
        reviewsCount: 128,
        owner: superadmin._id,
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
