import User from "../models/auth/user.model.js";
import Turf from "../models/turf.model.js";
import Booking from "../models/booking.model.js";
import Tournament from "../models/tournament.model.js";

/**
 * @desc    Get billing and revenue statistics for Super Admin
 * @route   GET /api/billing/stats
 * @access  Private (Super Admin)
 */
export const getBillingStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const isSuperAdmin = req.user.role === "superadmin";
    const adminId = req.user.id;
    
    // Create base date filter
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.createdAt.$lte = end;
      }
    }

    // Role-based filtering for turfs and tournaments
    let turfFilter = {};
    let tournamentFilter = {};
    
    if (!isSuperAdmin) {
      const adminTurfs = await Turf.find({ owner: adminId }).select("_id");
      const turfIds = adminTurfs.map(t => t._id);
      turfFilter = { turf: { $in: turfIds } };
      tournamentFilter = { owner: adminId };
    }

    // 1. Overall Revenue Breakdown
    const bookingStats = await Booking.aggregate([
      { $match: { ...dateQuery, ...turfFilter, status: { $in: ["confirmed", "completed"] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$paidAmount" },
          onlineRevenue: {
            $sum: { 
              $cond: [
                { $ne: ["$isOffline", true] }, 
                "$paidAmount", 
                0
              ] 
            }
          },
          offlineRevenue: {
            $sum: { 
              $cond: [
                { $eq: ["$isOffline", true] }, 
                "$paidAmount", 
                0
              ] 
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Tournament date filter (using registeredAt)
    const tournamentDateQuery = {};
    if (startDate || endDate) {
      tournamentDateQuery["registeredTeams.registeredAt"] = {};
      if (startDate) tournamentDateQuery["registeredTeams.registeredAt"].$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        tournamentDateQuery["registeredTeams.registeredAt"].$lte = end;
      }
    }

    const tournamentRevenueResult = await Tournament.aggregate([
      { $match: tournamentFilter },
      { $unwind: "$registeredTeams" },
      { $match: { ...tournamentDateQuery, "registeredTeams.status": { $in: ["confirmed", "completed", "paid"] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$registeredTeams.paymentDetails.amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      bookings: bookingStats[0] || { totalRevenue: 0, onlineRevenue: 0, offlineRevenue: 0, count: 0 },
      tournaments: tournamentRevenueResult[0] || { totalRevenue: 0, count: 0 },
    };
    
    // Ensure we are working with numbers
    stats.bookings.totalRevenue = Number(stats.bookings.totalRevenue || 0);
    stats.bookings.onlineRevenue = Number(stats.bookings.onlineRevenue || 0);
    stats.bookings.offlineRevenue = Number(stats.bookings.offlineRevenue || 0);
    stats.tournaments.totalRevenue = Number(stats.tournaments.totalRevenue || 0);
    
    stats.totalRevenue = stats.bookings.totalRevenue + stats.tournaments.totalRevenue;

    // 2. Admin-wise Revenue Breakdown (Only for Super Admin)
    let adminRevenueData = [];
    if (isSuperAdmin) {
      // Get all users who are explicitly "admin" or have turfs/tournaments
      const explicitlyAdmins = await User.find({ role: "admin" }).select("_id");
      const explicitlyAdminIds = explicitlyAdmins.map(a => a._id.toString());
      
      const turfOwners = await Turf.distinct("owner");
      const tournamentOwners = await Tournament.distinct("owner");
      
      // Combine and get unique IDs
      const allOwnerIds = [...new Set([
        ...explicitlyAdminIds, 
        ...turfOwners.map(id => id.toString()), 
        ...tournamentOwners.map(id => id.toString())
      ])];

      const admins = await User.find({ _id: { $in: allOwnerIds } }).select("name email role");
      
      adminRevenueData = await Promise.all(admins.map(async (admin) => {
        const adminTurfs = await Turf.find({ owner: admin._id }).select("_id");
        const turfIds = adminTurfs.map(t => t._id);

        const adminBookingStats = await Booking.aggregate([
          { $match: { ...dateQuery, turf: { $in: turfIds }, status: { $in: ["confirmed", "completed"] } } },
          {
            $group: {
              _id: null,
              total: { $sum: "$paidAmount" },
              online: { 
                $sum: { 
                  $cond: [
                    { $ne: ["$isOffline", true] }, 
                    "$paidAmount", 
                    0
                  ] 
                }
              },
              offline: { 
                $sum: { 
                  $cond: [
                    { $eq: ["$isOffline", true] }, 
                    "$paidAmount", 
                    0
                  ] 
                }
              }
            }
          }
        ]);

        const adminTournaments = await Tournament.aggregate([
          { $match: { owner: admin._id } },
          { $unwind: { path: "$registeredTeams", preserveNullAndEmptyArrays: true } },
          { 
            $match: { 
              $or: [
                { "registeredTeams.status": { $in: ["confirmed", "completed", "paid"] } },
                { "registeredTeams": { $exists: false } }
              ]
            } 
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ["$registeredTeams.paymentDetails.amount", 0] } }
            }
          }
        ]);

        const bookingRev = adminBookingStats[0] || { total: 0, online: 0, offline: 0 };
        const tournamentRev = adminTournaments[0] || { total: 0 };

        return {
          adminId: admin._id,
          name: admin.name || "N/A",
          email: admin.email || "N/A",
          bookingRevenue: {
            total: Number(bookingRev.total || 0),
            online: Number(bookingRev.online || 0),
            offline: Number(bookingRev.offline || 0)
          },
          tournamentRevenue: Number(tournamentRev.total || 0),
          totalRevenue: Number((bookingRev.total || 0) + (tournamentRev.total || 0))
        };
      }));

      // Sort by total revenue descending
      adminRevenueData.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    // 3. Recent Transactions
    const recentBookings = await Booking.find({ ...dateQuery, ...turfFilter, status: { $in: ["confirmed", "completed"] } })
      .sort({ createdAt: -1 })
      .limit(30) // Increased limit further to ensure we see data
      .populate({
        path: "turf",
        select: "name",
        model: "Turf"
      })
      .populate({
        path: "user",
        select: "name email",
        model: "User"
      });

    res.json({
      success: true,
      data: {
        summary: stats,
        adminBreakdown: isSuperAdmin ? adminRevenueData : null,
        recentTransactions: recentBookings
      }
    });

  } catch (error) {
    console.error("Get Billing Stats Error:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
