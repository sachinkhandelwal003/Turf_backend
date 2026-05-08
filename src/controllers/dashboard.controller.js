import User from "../models/auth/user.model.js";
import Turf from "../models/turf.model.js";
import Role from "../models/auth/role.model.js";
import Booking from "../models/booking.model.js";
import Tournament from "../models/tournament.model.js";

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private (Admin/Superadmin)
export const getDashboardStats = async (req, res) => {
  try {
    const isSuperadmin = req.user.role === "superadmin";
    const userId = req.user.id;

    // Filters for Admin
    const turfQuery = isSuperadmin ? {} : { owner: userId };
    const tournamentQuery = isSuperadmin ? {} : { owner: userId };
    const userQuery = isSuperadmin ? {} : { createdBy: userId };

    // Get turf IDs for non-superadmin to filter bookings
    let userTurfIds = [];
    if (!isSuperadmin) {
      const userTurfs = await Turf.find({ owner: userId }).select('_id');
      userTurfIds = userTurfs.map(t => t._id);
    }
    const bookingQuery = isSuperadmin ? {} : { turf: { $in: userTurfIds } };

    const [
      totalUsers,
      totalAdmins,
      totalSuperAdmins,
      totalTurfs,
      pendingTurfs,
      approvedTurfs,
      rejectedTurfs,
      totalRoles,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      totalTournaments,
      pendingTournaments,
      approvedTournaments,
      rejectedTournaments
    ] = await Promise.all([
      User.countDocuments({ ...userQuery, role: "user" }),
      User.countDocuments({ ...userQuery, role: "admin" }),
      User.countDocuments({ ...userQuery, role: "superadmin" }),
      Turf.countDocuments(turfQuery),
      Turf.countDocuments({ ...turfQuery, status: { $in: ["pending", null, undefined] } }),
      Turf.countDocuments({ ...turfQuery, status: "approved" }),
      Turf.countDocuments({ ...turfQuery, status: "rejected" }),
      Role.countDocuments(),
      Booking.countDocuments(bookingQuery),
      Booking.countDocuments({ ...bookingQuery, status: "confirmed" }),
      Booking.countDocuments({ ...bookingQuery, status: "pending" }),
      Booking.countDocuments({ ...bookingQuery, status: "cancelled" }),
      Tournament.countDocuments(tournamentQuery),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: { $in: ["pending", null, undefined] } }),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: "approved" }),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: "rejected" })
    ]);

    // Calculate Booking Revenue
    const bookingRevenueResult = await Booking.aggregate([
      { $match: { ...bookingQuery, status: "confirmed" } },
      { $group: { _id: null, total: { $sum: "$paidAmount" } } }
    ]);
    const bookingRevenue = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].total : 0;

    // Calculate Tournament Revenue
    const tournaments = await Tournament.find(tournamentQuery).select("registeredTeams");
    let tournamentRevenue = 0;
    tournaments.forEach(t => {
      (t.registeredTeams || []).forEach(reg => {
        if (reg.paymentDetails && reg.paymentDetails.amount) {
          tournamentRevenue += reg.paymentDetails.amount;
        }
      });
    });

    const totalRevenue = bookingRevenue + tournamentRevenue;

    // Get all turfs (removed .limit(10) to show all data as requested)
    const recentTurfs = await Turf.find(turfQuery)
      .sort("-createdAt")
      .populate("owner", "name email");

    // Get all users (removed .limit(10) to show all data as requested)
    const recentUsers = await User.find(userQuery)
      .sort("-createdAt")
      .select("-password");

    // Get all bookings (removed .limit(10) to show all data as requested)
    const recentBookings = await Booking.find(bookingQuery)
      .sort("-createdAt")
      .populate("turf", "name")
      .populate("user", "name email");

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
        bookings: {
          total: totalBookings,
          confirmed: confirmedBookings,
          pending: pendingBookings,
          cancelled: cancelledBookings
        },
        tournaments: {
          total: totalTournaments,
          pending: pendingTournaments,
          approved: approvedTournaments,
          rejected: rejectedTournaments
        },
        revenue: {
          total: totalRevenue,
          bookings: bookingRevenue,
          tournaments: tournamentRevenue
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

// @desc    Get public statistics for home page
// @route   GET /api/dashboard/public-stats
// @access  Public
export const getPublicStats = async (req, res) => {
  try {
    const [
      totalTurfs,
      totalUsers,
      totalBookings,
      turfsWithCities
    ] = await Promise.all([
      Turf.countDocuments({ status: "approved" }),
      User.countDocuments({ role: "user" }),
      Booking.countDocuments(),
      Turf.find({ status: "approved" }).select("location.city")
    ]);

    const uniqueCities = [...new Set(turfsWithCities.map(t => t.location.city))];
    const totalCities = uniqueCities.length;

    res.json({
      success: true,
      stats: {
        grounds: totalTurfs,
        players: totalUsers,
        cities: totalCities,
        bookings: totalBookings
      }
    });
  } catch (err) {
    console.error("Get Public Stats Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
