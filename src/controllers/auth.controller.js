import User from "../models/auth/user.model.js";
import Role from "../models/auth/role.model.js";
import Permission from "../models/auth/permission.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    // 1. Basic Validation
    if (!name || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ msg: "Passwords do not match" });
    }

    // --- 2. PRO LEVEL: Phone Validation (Indian Numbers Only) ---
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        msg: "Invalid phone number format. Must be a valid 10-digit Indian number." 
      });
    }

    // --- 3. PRO LEVEL: Password Strength Validation ---
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        msg: "Password is too weak. Must contain 8+ characters, 1 uppercase, 1 number, and 1 special character." 
      });
    }

    // 4. Duplicacy Check (Email AND Phone check dono lagaya hai)
    const exist = await User.findOne({ $or: [{ email }, { phone }] });
    if (exist) {
      return res.status(400).json({ msg: "User with this email or phone number already exists" });
    }

    // 5. Hashing & Creating User
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
    });

    // --- 6. PRO LEVEL Security: Response mein password mat bhejo ---
    const userResponse = user.toObject();
    delete userResponse.password;

    // token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      msg: "User registered successfully",
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server Error. Please try again later." });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // check user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" }); // Pro tip: Don't say "User not found", say "Invalid credentials"
    }

    // check if user is active
    if (!user.isActive) {
      return res.status(403).json({ msg: "Your account is deactivated. Please contact admin." });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // --- Security: Remove password before sending to frontend ---
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      msg: "Login successful",
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server Error. Please try again later." });
  }
};

// IMPERSONATE (Login as another user)
// @access Private (Superadmin only)
export const impersonate = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ msg: "User ID is required" });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ msg: "Target user not found" });
    }

    // Generate token for the target user
    const token = jwt.sign(
      {
        id: targetUser._id,
        role: targetUser.role,
        permissions: targetUser.permissions || [],
        isImpersonated: true,
        impersonatorId: req.user.id
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" } // Impersonation tokens should have shorter lifespan
    );

    const userResponse = targetUser.toObject();
    delete userResponse.password;

    res.json({
      msg: `Logged in as ${targetUser.name}`,
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Impersonation Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updateData = { name, phone };

    if (req.file) {
      updateData.profilePhoto = `/uploads/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      success: true,
      msg: "Profile updated successfully",
      user,
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// GET PROFILE
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("Profile Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// BATCH UPDATE USERS (Admin/Superadmin only)
export const batchUpdateUsers = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { userId, role, permissions, isActive }

    const results = await Promise.all(updates.map(async (update) => {
      const { userId, ...data } = update;
      
      const userToUpdate = await User.findById(userId);
      if (!userToUpdate) return { userId, success: false, error: "Not found" };

      // Check ownership if not superadmin
      if (req.user.role !== "superadmin" && userToUpdate.createdBy?.toString() !== req.user.id) {
        return { userId, success: false, error: "Not authorized" };
      }

      const updated = await User.findByIdAndUpdate(userId, data, { new: true }).select("-password");
      return { userId, success: true, user: updated };
    }));

    res.json({ success: true, results });
  } catch (err) {
    console.error("Batch Update Users Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// GET ALL USERS (Admin/Superadmin only)
export const getAllUsers = async (req, res) => {
  try {
    let query = {};
    
    // If user is admin, they can only see users they created
    if (req.user.role === "admin") {
      query.createdBy = req.user.id;
    }
    // If superadmin, they can see everyone (no query filter)

    const users = await User.find(query).select("-password").populate("createdBy", "name");
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get All Users Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// UPDATE USER ROLE & PERMISSIONS (Admin/Superadmin only)
export const updateUserRBAC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, permissions, isActive, name, email, phone } = req.body;

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Check ownership if not superadmin
    if (req.user.role !== "superadmin" && userToUpdate.createdBy?.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to update this user" });
    }

    const updateData = { role, isActive, name, email, phone };
    if (permissions) {
      updateData.permissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
    }

    if (req.file) {
      updateData.profilePhoto = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    res.json({ success: true, msg: "User updated successfully", user: updatedUser });
  } catch (err) {
    console.error("Update User RBAC Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// CREATE USER (Admin/Superadmin only)
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, permissions } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ msg: "User with this email or phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || "user",
      permissions: permissions ? (typeof permissions === 'string' ? JSON.parse(permissions) : permissions) : [],
      createdBy: req.user.id
    };

    if (req.file) {
      userData.profilePhoto = `/uploads/${req.file.filename}`;
    }

    const user = await User.create(userData);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ success: true, msg: "User created successfully", user: userResponse });
  } catch (err) {
    console.error("Create User Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// DELETE USER (Admin/Superadmin only)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deleting self
    if (userId === req.user.id) {
      return res.status(400).json({ msg: "You cannot delete yourself" });
    }

    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Check ownership if not superadmin
    if (req.user.role !== "superadmin" && userToDelete.createdBy?.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to delete this user" });
    }

    await userToDelete.deleteOne();
    res.json({ success: true, msg: "User deleted successfully" });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// GET ALL AVAILABLE PERMISSIONS
export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ name: 1 });
    res.json({ success: true, permissions });
  } catch (err) {
    console.error("Get Permissions Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const createPermission = async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    
    const existing = await Permission.findOne({ $or: [{ name }, { slug }] });
    if (existing) {
      return res.status(400).json({ error: "Permission with this name or slug already exists" });
    }

    const permission = await Permission.create({ name, slug, description });
    res.status(201).json({ success: true, permission });
  } catch (err) {
    console.error("Create Permission Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const updatePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { name, slug, description, isActive } = req.body;

    const permission = await Permission.findByIdAndUpdate(
      permissionId,
      { name, slug, description, isActive },
      { new: true }
    );

    if (!permission) {
      return res.status(404).json({ error: "Permission not found" });
    }

    res.json({ success: true, permission });
  } catch (err) {
    console.error("Update Permission Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const deletePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const permission = await Permission.findByIdAndDelete(permissionId);
    
    if (!permission) {
      return res.status(404).json({ error: "Permission not found" });
    }

    res.json({ success: true, msg: "Permission deleted successfully" });
  } catch (err) {
    console.error("Delete Permission Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// ROLE CRUD
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.json({ success: true, roles });
  } catch (err) {
    console.error("Get Roles Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const role = await Role.create({ name, permissions });
    res.json({ success: true, role });
  } catch (err) {
    console.error("Create Role Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, permissions } = req.body;
    const role = await Role.findByIdAndUpdate(roleId, { name, permissions }, { new: true });
    res.json({ success: true, role });
  } catch (err) {
    console.error("Update Role Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    await Role.findByIdAndDelete(roleId);
    res.json({ success: true, msg: "Role deleted" });
  } catch (err) {
    console.error("Delete Role Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};  