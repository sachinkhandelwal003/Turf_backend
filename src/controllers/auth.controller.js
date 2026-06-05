import User from "../models/auth/user.model.js";
import Role from "../models/auth/role.model.js";
import Permission from "../models/auth/permission.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
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

    // --- 2. PRO LEVEL: Phone Validation ---
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return res.status(400).json({ 
        msg: "Invalid phone number format. Must contain at least 10 digits." 
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
    res.status(500).json({ success: false, msg: "Internal server error. Please try again later." });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, msg: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // check user
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ success: false, msg: "Invalid email or password" });
    }

    // check if user is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, msg: "Your account is deactivated. Please contact support." });
    }

    // check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, msg: "Invalid email or password" });
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
    res.status(500).json({ success: false, msg: "Internal server error. Please try again later." });
  }
};

// LOGOUT
export const logout = async (req, res) => {
  try {
    res.json({ success: true, msg: "Logged out successfully" });
  } catch (err) {
    console.error("Logout Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
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
        updateData.profilePhoto = req.files.profilePhoto[0].path || req.files.profilePhoto[0].secure_url;
      }
      if (req.files.coverPhoto) {
        updateData.coverPhoto = req.files.coverPhoto[0].path || req.files.coverPhoto[0].secure_url;
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
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// UPDATE PASSWORD
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, msg: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, msg: "New passwords do not match" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, msg: "Current password is incorrect" });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        success: false,
        msg: "New password is too weak. Must contain 8+ characters, 1 uppercase, 1 number, and 1 special character." 
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, msg: "Password updated successfully" });
  } catch (err) {
    console.error("Update Password Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
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

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #1abc60; }
        .logo { font-size: 28px; font-weight: bold; color: #1abc60; text-decoration: none; }
        .content { padding: 30px 0; line-height: 1.6; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { background-color: #1abc60; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(26, 188, 96, 0.2); }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; border-top: 1px solid #eee; margin-top: 20px; }
        .warning { background-color: #fff8f0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="${frontendUrl}" class="logo">GameOn India</a>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name || 'User'},</p>
          <p>You are receiving this email because you (or someone else) have requested to reset the password for your GameOn India account.</p>
          <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
          
          <div class="button-container">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>

          <div class="warning">
            If you did not request this, please ignore this email and your password will remain unchanged.
          </div>

          <p>If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 13px; color: #1abc60;">${resetUrl}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} GameOn India. All rights reserved.</p>
          <p>Manage your turf bookings effortlessly.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: "GameOn India - Password Reset Request",
        message,
        html
      });

      res.status(200).json({ success: true, msg: "Password reset link sent to your email." });
    } catch (err) {
      console.error("Email send error details:", err);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      // Return a professional, generic message to the user
      // Log the specific error for the developer internally
      return res.status(500).json({ 
        success: false, 
        msg: "Unable to send reset email. Please try again later or contact support."
      });
    }
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, msg: "Token and password are required" });
    }

    // 1. Hash token (since we stored hashed version)
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 2. Find user with valid token and expiry
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, msg: "Invalid or expired reset token" });
    }

    // 3. Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ success: true, msg: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// RESET USER PASSWORD (Superadmin only)
export const resetUserPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, msg: "Password must be at least 6 characters" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.json({ success: true, msg: "Password updated successfully" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
};

// GET ADMIN ACCOUNTS WITH TURF DETAILS (Superadmin only)
export const getAdminAccounts = async (req, res) => {
  try {
    // Only superadmin should access this
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }

    // Find all users with role 'admin'
    const admins = await User.find({ role: "admin" }).select("-password").lean();

    // For each admin, find their turf
    const adminAccounts = await Promise.all(
      admins.map(async (admin) => {
        const Turf = mongoose.model("Turf");
        const turf = await Turf.findOne({ owner: admin._id }).select("name location").lean();
        return {
          ...admin,
          turfName: turf ? turf.name : "No Turf Assigned",
          turfCity: turf ? turf.location?.city : "N/A",
        };
      })
    );

    res.json({ success: true, accounts: adminAccounts });
  } catch (err) {
    console.error("Get Admin Accounts Error:", err);
    res.status(500).json({ success: false, msg: "Server Error" });
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
    const { role, permissions, isActive, name, email, phone, password, turfId } = req.body;

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
      updateData.profilePhoto = req.file.path || req.file.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password");

    // Manage Turf ownership based on role and turfId
    const targetRole = role || userToUpdate.role;
    if (targetRole === 'admin') {
      const Turf = mongoose.model("Turf");
      // Clear previous ownerships for this user
      await Turf.updateMany({ owner: userId }, { owner: null });
      if (turfId) {
        // Set new ownership
        await Turf.findByIdAndUpdate(turfId, { owner: userId });
      }
    } else {
      // If role is no longer admin, clear any turf ownership
      const Turf = mongoose.model("Turf");
      await Turf.updateMany({ owner: userId }, { owner: null });
    }

    res.json({ success: true, msg: "User updated successfully", user: updatedUser });
  } catch (err) {
    console.error("Update User RBAC Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// CREATE USER (Admin/Superadmin only)
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, permissions, turfId } = req.body;

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
      userData.profilePhoto = req.file.path || req.file.secure_url;
    }

    const user = await User.create(userData);

    // Fetch Turf details if turfId is provided
    let assignedTurf = null;
    if (turfId && user.role === "admin") {
      const Turf = mongoose.model("Turf");
      assignedTurf = await Turf.findByIdAndUpdate(turfId, { owner: user._id }, { new: true });
    }

    // --- PRO LEVEL: Send Welcome Email for Admin Accounts ---
    if (user.role === "admin" || user.role === "superadmin") {
      const frontendUrl = process.env.FRONTEND_URL || "https://gameonindia.tech";
      const loginUrl = `${frontendUrl}/admin/login`;

      console.log(`Triggering welcome email for ${user.role}: ${user.email}`);

      let turfDetailsHtml = "";
      let turfDetailsText = "";

      if (assignedTurf) {
        turfDetailsHtml = `
        <div class="cred-box" style="background-color: #f0f7ff; border: 1px solid #d0e7ff; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #0056b3;">Your Turf Details:</h4>
          <p style="margin-bottom: 5px;"><strong>Venue Name:</strong> ${assignedTurf.name}</p>
          <p style="margin-bottom: 5px;"><strong>Address:</strong> ${assignedTurf.location?.address || 'N/A'}, ${assignedTurf.location?.city || 'N/A'}</p>
          <p style="margin-bottom: 5px;"><strong>Contact Phone:</strong> ${user.phone}</p>
          <p style="margin-bottom: 5px;"><strong>Contact Email:</strong> ${user.email}</p>
        </div>
        `;
        turfDetailsText = `\nYour Turf Details:\nVenue Name: ${assignedTurf.name}\nAddress: ${assignedTurf.location?.address || 'N/A'}, ${assignedTurf.location?.city || 'N/A'}\nContact Phone: ${user.phone}\nContact Email: ${user.email}\n`;
      }

      const welcomeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
          .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #1abc60; }
          .logo { font-size: 28px; font-weight: bold; color: #1abc60; text-decoration: none; }
          .content { padding: 30px 0; line-height: 1.6; }
          .cred-box { background-color: #f4fbf7; border: 1px solid #d1f2eb; padding: 20px; border-radius: 12px; margin: 20px 0; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { background-color: #1abc60; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(26, 188, 96, 0.2); }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; border-top: 1px solid #eee; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <a href="${frontendUrl}" class="logo">GameOn India</a>
          </div>
          <div class="content">
            <h2 style="color: #1abc60;">Congratulations, ${user.name}!</h2>
            <p>Welcome to the GameOn India community. You have been registered as a <strong>${user.role.toUpperCase()}</strong> member.</p>
            <p>You can now manage your venue, bookings, and matches through our admin portal.</p>
            
            <div class="cred-box">
              <h4 style="margin-top: 0; color: #1abc60;">Your Access Credentials:</h4>
              <p style="margin-bottom: 5px;"><strong>Email:</strong> ${user.email}</p>
              <p style="margin-bottom: 5px;"><strong>Password:</strong> ${password}</p>
              <p style="font-size: 12px; color: #e67e22; margin-top: 10px;">*Please change your password after your first login for security.</p>
            </div>

            ${turfDetailsHtml}

            <div class="button-container">
              <a href="${loginUrl}" class="button">Login to Admin Portal</a>
            </div>

            <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} GameOn India. All rights reserved.</p>
            <p>Revolutionizing Sports Management.</p>
          </div>
        </div>
      </body>
      </html>
      `;

      try {
        await sendEmail({
          email: user.email,
          subject: "Welcome to GameOn India - Admin Access Granted",
          message: `Welcome ${user.name}! Your admin account has been created.\n\nYour Access Credentials:\nEmail: ${user.email}\nPassword: ${password}\n${turfDetailsText}\nLogin at: ${loginUrl}`,
          html: welcomeHtml
        });
        console.log(`Welcome email sent successfully to: ${user.email}`);
      } catch (emailErr) {
        console.error("CRITICAL: Welcome email failed to send!");
        console.error("Email Error Trace:", emailErr.message);
      }
    }

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