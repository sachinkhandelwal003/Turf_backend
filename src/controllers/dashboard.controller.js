import User from "../models/auth/user.model.js";
import Turf from "../models/turf.model.js";
import Role from "../models/auth/role.model.js";

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private (Admin/Superadmin)
export const getDashboardStats = async (req, res) => {
  try {
    const isSuperadmin = req.user.role === "superadmin";
    const userId = req.user.id;

    // Filters for Admin
    const turfQuery = isSuperadmin ? {} : { owner: userId };
    const userQuery = isSuperadmin ? {} : { createdBy: userId };

    const [
      totalUsers,
      totalAdmins,
      totalSuperAdmins,
      totalTurfs,
      pendingTurfs,
      approvedTurfs,
      rejectedTurfs,
      totalRoles
    ] = await Promise.all([
      User.countDocuments({ ...userQuery, role: "user" }),
      User.countDocuments({ ...userQuery, role: "admin" }),
      User.countDocuments({ ...userQuery, role: "superadmin" }),
      Turf.countDocuments(turfQuery),
      Turf.countDocuments({ ...turfQuery, status: { $in: ["pending", null, undefined] } }),
      Turf.countDocuments({ ...turfQuery, status: "approved" }),
      Turf.countDocuments({ ...turfQuery, status: "rejected" }),
      Role.countDocuments()
    ]);

    // Get recent turfs
    const recentTurfs = await Turf.find(turfQuery)
      .sort("-createdAt")
      .limit(10)
      .populate("owner", "name email");

    // Get recent users
    const recentUsers = await User.find(userQuery)
      .sort("-createdAt")
      .limit(10)
      .select("-password");

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers + totalAdmins + totalSuperAdmins,
          customers: totalUsers,
          admins: totalAdmins,
          superadmins: totalSuperAdmins
        },
        turfs: {
          total: totalTurfs,
          pending: pendingTurfs,
          approved: approvedTurfs,
          rejected: rejectedTurfs
        },
        roles: totalRoles
      },
      recentTurfs,
      recentUsers
    });
  } catch (err) {
    console.error("Get Dashboard Stats Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
