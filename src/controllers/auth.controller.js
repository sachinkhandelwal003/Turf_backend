import User from "../models/auth/user.model.js";
import Role from "../models/auth/role.model.js";
import Permission from "../models/auth/permission.model.js";
import Settings from "../models/settings.model.js";
import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import { sendEmail } from "../utils/email.js";
import { sendPushAndSave } from "../utils/firebase.js";

// REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, fcmToken } = req.body;

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

    // Generate verification token (30 min expiry)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 30 * 60 * 1000; // 30 minutes

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "user",
      isVerified: false,
      verificationToken,
      verificationExpires,
      fcmToken: fcmToken || null,
    });

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || "https://gameon-india.com";
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const message = `Hi ${name},\n\nPlease verify your email by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 30 minutes.\n\nIf you didn't create this account, please ignore this email.`;

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
            <h2>Email Verification Required</h2>
            <p>Hi ${name},</p>
            <p>Thank you for signing up! Please verify your email address by clicking the button below.</p>
            
            <div class="button-container">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>

            <div class="warning">
              This verification link will expire in <strong>30 minutes</strong>.
            </div>

            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-size: 13px; color: #1abc60;">${verificationUrl}</p>
            <p>If you didn't create this account, please ignore this email.</p>
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
        subject: "Verify your GameOn India account",
        message,
        html
      });
    } catch (emailErr) {
      console.error("Email Send Error:", emailErr);
      // If email fails, we can still proceed but inform the user?
    }

    // Send welcome push notification
    if (user.fcmToken) {
      sendPushAndSave(
        user._id,
        user.fcmToken,
        "Welcome to GameOn India 🎉",
        `Hi ${name}! Thanks for signing up. Start booking turfs and joining matches now!`,
        "welcome"
      ).catch(err => console.error("Welcome notification error:", err));
    }

    // --- 6. PRO LEVEL Security: Response mein password mat bhejo ---
    const userResponse = user.toObject();
    delete userResponse.password;

    // Don't log the user in immediately, require email verification first
    res.status(201).json({
      success: true,
      msg: "User registered successfully. Please check your email for verification link.",
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error. Please try again later." });
  }
};

// VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, msg: "Verification token is required" });
    }

    let user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() },
    });

    // If no user found, check if user is already verified
    if (!user) {
      user = await User.findOne({ verificationToken: token });
      if (user && user.isVerified) {
        // User is already verified, generate new token
        const authToken = jwt.sign(
          {
            id: user._id,
            role: user.role,
            permissions: user.permissions || [],
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );
        const userResponse = user.toObject();
        delete userResponse.password;
        return res.status(200).json({
          success: true,
          msg: "Email is already verified",
          token: authToken,
          user: userResponse,
        });
      }
      return res.status(400).json({ success: false, msg: "Invalid or expired verification link" });
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    // Generate token
    const authToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      msg: "Email verified successfully",
      token: authToken,
      user: userResponse,
    });
  } catch (err) {
    console.error("Verify Email Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error. Please try again later." });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password, fcmToken } = req.body;

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

    // Save FCM token if provided
    if (fcmToken) {
      user.fcmToken = fcmToken;
      await user.save();
    }

    // Send login alert notification
    if (user.fcmToken) {
      sendPushAndSave(
        user._id,
        user.fcmToken,
        "New Login Detected 🔐",
        `Hi ${user.name}, your account was just logged into. If this wasn't you, please change your password immediately.`,
        "login_alert"
      ).catch(err => console.error("Login alert notification error:", err));
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

    if (req.files && Array.isArray(req.files)) {
      // Convert array to object for easier access
      const filesObj = {};
      req.files.forEach(file => {
        if (!filesObj[file.fieldname]) {
          filesObj[file.fieldname] = [];
        }
        filesObj[file.fieldname].push(file);
      });
      
      if (filesObj.profilePhoto) {
        updateData.profilePhoto = filesObj.profilePhoto[0].path || filesObj.profilePhoto[0].secure_url;
      }
      if (filesObj.coverPhoto) {
        updateData.coverPhoto = filesObj.coverPhoto[0].path || filesObj.coverPhoto[0].secure_url;
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
    const frontendUrl = process.env.FRONTEND_URL || "https://gameon-india.com";
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

    if (req.files && Array.isArray(req.files)) {
      // Convert array to object for easier access
      const filesObj = {};
      req.files.forEach(file => {
        if (!filesObj[file.fieldname]) {
          filesObj[file.fieldname] = [];
        }
        filesObj[file.fieldname].push(file);
      });
      
      if (filesObj.profilePhoto) {
        updateData.profilePhoto = filesObj.profilePhoto[0].path || filesObj.profilePhoto[0].secure_url;
      }
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

    const userRole = role || "user";
    const userData = {
      name,
      email: cleanEmail,
      phone,
      password: hashedPassword,
      role: userRole,
      permissions: permissions ? (typeof permissions === 'string' ? JSON.parse(permissions) : permissions) : [],
      createdBy: req.user.id,
      isVerified: userRole === 'admin' || userRole === 'superadmin'
    };

    if (req.files && Array.isArray(req.files)) {
      // Convert array to object for easier access
      const filesObj = {};
      req.files.forEach(file => {
        if (!filesObj[file.fieldname]) {
          filesObj[file.fieldname] = [];
        }
        filesObj[file.fieldname].push(file);
      });
      
      if (filesObj.profilePhoto) {
        userData.profilePhoto = filesObj.profilePhoto[0].path || filesObj.profilePhoto[0].secure_url;
      }
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
      const frontendUrl = process.env.FRONTEND_URL || "https://gameon-india.com";
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

// GOOGLE LOGIN
export const googleLogin = async (req, res) => {
  try {
    const { tokenId, fcmToken } = req.body;

    if (!tokenId) {
      return res.status(400).json({ success: false, msg: "Token ID is required" });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name;
    const picture = payload?.picture;

    if (!email || !name) {
      return res.status(400).json({ success: false, msg: "Invalid Google token" });
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // If user exists but doesn't have googleId, update it
      if (!user.googleId) {
        user.googleId = googleId;
      }
      // Save FCM token if provided
      if (fcmToken) {
        user.fcmToken = fcmToken;
      }
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        role: "user",
        profilePhoto: picture || "",
        isVerified: true,
        fcmToken: fcmToken || null,
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, msg: "Your account is deactivated. Please contact support." });
    }

    // Send notification
    if (user.fcmToken) {
      // Check if user was just created (new user)
      const isNewUser = user.createdAt > new Date(Date.now() - 5000); // Within last 5 seconds
      if (isNewUser) {
        sendPushAndSave(
          user._id,
          user.fcmToken,
          "Welcome to GameOn India 🎉",
          `Hi ${user.name}! Thanks for signing up with Google. Start booking turfs and joining matches now!`,
          "welcome"
        ).catch(err => console.error("Welcome notification error:", err));
      } else {
        sendPushAndSave(
          user._id,
          user.fcmToken,
          "New Login Detected 🔐",
          `Hi ${user.name}, your account was just logged into with Google. If this wasn't you, please change your password immediately.`,
          "login_alert"
        ).catch(err => console.error("Login alert notification error:", err));
      }
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      msg: "Login successful",
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Google Login Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// APPLE LOGIN
export const appleLogin = async (req, res) => {
  try {
    const { idToken, fullName, fcmToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, msg: "ID Token is required" });
    }

    // Verify Apple ID Token
    const appleSigninOptions = {
      clientId: process.env.APPLE_CLIENT_ID, // Service ID (Client ID) from Apple Developer Portal
      nonce: undefined, // We don't use nonce right now
    };

    const payload = await appleSignin.verifyIdToken(idToken, appleSigninOptions);
    const appleId = payload.sub;
    const email = payload.email;

    if (!appleId) {
      return res.status(400).json({ success: false, msg: "Invalid Apple token" });
    }

    // Check if user exists
    let user = await User.findOne({
      $or: [{ appleId }, email ? { email: email.toLowerCase() } : { _id: null }],
    });

    if (user) {
      // If user exists but doesn't have appleId, update it
      if (!user.appleId) {
        user.appleId = appleId;
      }
      // Update email if we got it and user doesn't have one
      if (email && !user.email) {
        user.email = email.toLowerCase();
      }
      // Save FCM token if provided
      if (fcmToken) {
        user.fcmToken = fcmToken;
      }
      await user.save();
    } else {
      // Create new user
      let userName = "Apple User";
      // Try to get name from fullName (Apple only sends this on first sign-in)
      if (fullName && (fullName.givenName || fullName.familyName)) {
        userName = [fullName.givenName, fullName.familyName].filter(Boolean).join(" ");
      } else if (email) {
        userName = email.split("@")[0];
      }

      user = await User.create({
        name: userName,
        email: email ? email.toLowerCase() : `apple_${appleId}@example.com`,
        appleId,
        role: "user",
        profilePhoto: "",
        isVerified: true, // Apple emails are already verified
        fcmToken: fcmToken || null,
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, msg: "Your account is deactivated. Please contact support." });
    }

    // Send notification
    if (user.fcmToken) {
      // Check if user was just created (new user)
      const isNewUser = user.createdAt > new Date(Date.now() - 5000); // Within last 5 seconds
      if (isNewUser) {
        sendPushAndSave(
          user._id,
          user.fcmToken,
          "Welcome to GameOn India 🎉",
          `Hi ${user.name}! Thanks for signing up with Apple. Start booking turfs and joining matches now!`,
          "welcome"
        ).catch(err => console.error("Welcome notification error:", err));
      } else {
        sendPushAndSave(
          user._id,
          user.fcmToken,
          "New Login Detected 🔐",
          `Hi ${user.name}, your account was just logged into with Apple. If this wasn't you, please change your password immediately.`,
          "login_alert"
        ).catch(err => console.error("Login alert notification error:", err));
      }
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      msg: "Login successful",
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Apple Login Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// UPDATE FCM TOKEN
export const updateFCM = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, msg: "FCM token is required" });
    }

    await User.findByIdAndUpdate(req.user.id, { fcmToken });

    res.json({
      success: true,
      msg: "FCM token updated successfully"
    });
  } catch (err) {
    console.error("Update FCM Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// DELETE OWN ACCOUNT (User self-delete)
export const deleteOwnAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    await user.deleteOne();
    res.json({ success: true, msg: "Your account has been deleted successfully" });
  } catch (err) {
    console.error("Delete Account Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Generate OTP for Account Deletion (Public)
export const sendDeleteAccountOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, msg: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, msg: "No account found with this email" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save OTP and set expiry (10 minutes)
    user.deleteAccountOTP = otp;
    user.deleteAccountOTPExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send OTP via email
    try {
      await sendEmail({
        email: user.email,
        subject: "GameOn India - Account Deletion OTP",
        message: `Your OTP for account deletion is: ${otp}\nThis OTP is valid for 10 minutes.\nIf you did not request this, please ignore this email.`
      });
    } catch (emailErr) {
      console.error("Failed to send deletion OTP email:", emailErr);
    }

    console.log("Delete Account OTP for", email, ":", otp);

    res.json({ 
      success: true, 
      msg: "OTP sent to your registered email" 
    });
  } catch (err) {
    console.error("Send Delete OTP Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// Verify OTP and Delete Account (Public)
export const verifyDeleteAccountOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, msg: "Email and OTP are required" });
    }

    // Find user with valid OTP
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      deleteAccountOTP: otp, 
      deleteAccountOTPExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ success: false, msg: "Invalid or expired OTP" });
    }

    // Delete the user
    await user.deleteOne();

    res.json({ 
      success: true, 
      msg: "Your account has been deleted successfully" 
    });
  } catch (err) {
    console.error("Verify Delete OTP Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};