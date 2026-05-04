import User from "../models/auth/user.model.js";
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

    res.status(201).json({
      msg: "User registered successfully",
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

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role, // Assuming you might have roles later (admin, user, turf_owner)
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // --- Security: Remove password before sending to frontend ---
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      msg: "Login successful",
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server Error. Please try again later." });
  }
};  