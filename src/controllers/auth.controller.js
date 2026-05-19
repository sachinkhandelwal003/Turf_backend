import User from "../models/auth/user.model.js";
import Role from "../models/auth/role.model.js";
import Permission from "../models/auth/permission.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../utils/email.js";

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

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // check user
    const user = await User.findOne({ email: cleanEmail });
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

// LOGOUT
export const logout = async (req, res) => {
  try {
    // For JWT, logout is usually handled on frontend by removing token.
    // However, having a backend endpoint is standard for apps to clear sessions/cookies.
    res.json({
      success: true,
      msg: "Logged out successfully"
    });
  } catch (err) {
    console.error("Logout Error:", err);
    res.status(500).json({ error: "Server Error" });
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
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    if (req.files) {
      if (req.files.profilePhoto) {
        updateData.profilePhoto = `/uploads/${req.files.profilePhoto[0].filename}`;
      }
      if (req.files.coverPhoto) {
        updateData.coverPhoto = `/uploads/${req.files.coverPhoto[0].filename}`;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ msg: "No data provided for update" });
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

// UPDATE PASSWORD
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ msg: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: "New passwords do not match" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Current password is incorrect" });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        msg: "New password is too weak. Must contain 8+ characters, 1 uppercase, 1 number, and 1 special character." 
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, msg: "Password updated successfully" });
  } catch (err) {
    console.error("Update Password Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, msg: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    console.log("Forgot Password Request for:", email);
    if (!user) {
      console.log("User not found in database for email:", email);
      return res.status(404).json({ 
        success: false, 
        msg: "No account found with this email address." 
      });
    }

    console.log("User found:", user.name, "(ID:", user._id, ")");

    // 1. Generate random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 2. Hash token and save to database
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 3. Set expiry (e.g., 1 hour)
    user.resetPasswordExpires = Date.now() + 3600000;

    await user.save();

    // 4. Create reset URL
    // Use frontend URL from env or fallback to localhost
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3005";
    const resetUrl = `${frontendUrl}/ResetPassword?token=${resetToken}`;

    const message = `You are receiving this email because you (or someone else) have requested the reset of a password. Please click on the following link, or paste this into your browser to complete the process:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset Token",
        message,
      });

      res.status(200).json({ success: true, msg: "Email sent" });
    } catch (err) {
      console.error("Email send error details:", err);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      let errorMsg = "Email could not be sent.";
      
      if (err.message.includes('Invalid login')) {
        errorMsg = "Invalid Email App Password. Please check your .env file.";
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        errorMsg = "Connection to email server failed. Check your internet.";
      } else if (err.message.includes('not configured')) {
        errorMsg = "Email service not configured.";
      } else {
        // Show the actual error message for debugging
        errorMsg = `Email Error: ${err.message}`;
      }

      return res.status(500).json({ 
        success: false, 
        msg: errorMsg
      });
    }
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, msg: "Token and password are required" });
    }

    // 1. Hash the token from URL to compare with stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 2. Find user by token and ensure token is not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, msg: "Invalid or expired token" });
    }

    // 3. Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    // 4. Clear reset token fields
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({ success: true, msg: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
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
    const { role, permissions, isActive, name, email, phone, password } = req.body;

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Check ownership if not superadmin
    if (req.user.role !== "superadmin" && userToUpdate.createdBy?.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to update this user" });
    }

    const updateData = {};
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone) updateData.phone = phone;

    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    if (permissions) {
      updateData.permissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
    }

    if (req.file) {
      updateData.profilePhoto = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
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

    // Basic Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ msg: "Name, email, phone and password are required" });
    }

    // Check if user already exists
    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ $or: [{ email: cleanEmail }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ msg: "User with this email or phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email: cleanEmail,
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