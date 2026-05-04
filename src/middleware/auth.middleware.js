import jwt from "jsonwebtoken";
import User from "../models/auth/user.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ msg: "No token provided" });
    }

    // Handle Bearer token format
    if (token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database to get latest permissions and status
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ msg: "Account deactivated" });
    }

    req.user = user; // store full user object
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
};