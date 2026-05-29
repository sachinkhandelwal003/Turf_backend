import User from "../models/auth/user.model.js";
import Turf from "../models/turf.model.js";
import Role from "../models/auth/role.model.js";
import Booking from "../models/booking.model.js";
import Tournament from "../models/tournament.model.js";
import Master from "../models/master.model.js";
import Match from "../models/match.model.js";
import Settlement from "../models/settlement.model.js";

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private (Admin/Superadmin)
export const getDashboardStats = async (req, res) => {
  try {
    const isSuperadmin = req.user.role === "superadmin";
    const userId = req.user.id;
    const { city, turfId } = req.query;

    // Filters for Admin
    let turfQuery = isSuperadmin ? {} : { owner: userId };
    let tournamentQuery = isSuperadmin ? {} : { owner: userId };
    let userQuery = isSuperadmin ? {} : { createdBy: userId };

    // Apply filters from query params
    if (city) {
      turfQuery["location.city"] = city;
      tournamentQuery["location.city"] = city;
    }
    if (turfId) {
      turfQuery["_id"] = turfId;
    }

    // Get turf IDs for filtering bookings
    const filteredTurfs = await Turf.find(turfQuery).select('_id');
    const filteredTurfIds = filteredTurfs.map(t => t._id);

    // Filter bookings based on filtered turfs
    let bookingQuery = { turf: { $ne: null } };
    if (!isSuperadmin || city || turfId) {
      bookingQuery = { ...bookingQuery, turf: { $in: filteredTurfIds } };
    }

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
      rejectedTournaments,
      totalSettlements
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
      Booking.countDocuments({ ...bookingQuery, status: { $in: ["confirmed", "completed"] } }),
      Booking.countDocuments({ ...bookingQuery, status: "pending" }),
      Booking.countDocuments({ ...bookingQuery, status: "cancelled" }),
      Tournament.countDocuments(tournamentQuery),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: { $in: ["pending", null, undefined] } }),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: "approved" }),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: "rejected" }),
      Settlement.aggregate([
        { $match: isSuperadmin ? {} : { admin: userId } },
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const settlementsPaid = totalSettlements.length > 0 ? totalSettlements[0].total : 0;

    // Calculate Booking Revenue using Aggregation (Efficient & Dynamic)
    const bookingRevenueResult = await Booking.aggregate([
      { $match: { ...bookingQuery, status: { $in: ["confirmed", "completed"] } } },
      { 
        $group: { 
          _id: null, 
          total: { $sum: { $ifNull: ["$totalAmount", "$price"] } }, // Fallback to price if totalAmount missing
          paid: { $sum: { $ifNull: ["$paidAmount", 0] } },
          offline: { 
            $sum: { $cond: [{ $eq: ["$isOffline", true] }, { $ifNull: ["$paidAmount", 0] }, 0] } 
          },
          wallet: { 
            $sum: { $cond: [{ $ne: ["$isOffline", true] }, { $ifNull: ["$paidAmount", 0] }, 0] } 
          }
        } 
      }
    ]);

    const bookingTotal = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].total : 0;
    const bookingPaid = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].paid : 0;
    const offlineRevenue = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].offline : 0;
    const walletRevenue = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].wallet : 0;

    // Calculate Tournament Revenue using Aggregation (More efficient than forEach)
    const tournamentRevenueResult = await Tournament.aggregate([
      { $match: tournamentQuery },
      { $unwind: "$registeredTeams" },
      { $match: { "registeredTeams.status": { $in: ["confirmed", "completed", "paid"] } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$registeredTeams.paymentDetails.amount", 0] } }
        }
      }
    ]);

    const tournamentRevenue = tournamentRevenueResult.length > 0 ? tournamentRevenueResult[0].total : 0;

    // Calculate Match Revenue using Aggregation
    const matchRevenueResult = await Match.aggregate([
      { $match: { ...bookingQuery, status: { $in: ["open", "full", "completed"] } } },
      {
        $project: {
          confirmedPlayersCount: {
            $size: {
              $filter: {
                input: "$joinedPlayers",
                as: "player",
                cond: { $eq: ["$$player.status", "confirmed"] }
              }
            }
          },
          pricePerPlayer: 1
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$confirmedPlayersCount", { $ifNull: ["$pricePerPlayer", 0] }] } }
        }
      }
    ]);

    const matchRevenue = matchRevenueResult.length > 0 ? matchRevenueResult[0].total : 0;
    
    // Revenue Breakdown Logic
    // Platform usually takes a cut from online payments. 
    // For matches, it's explicitly 20% according to current logic.
    // For bookings and tournaments, we can apply a platform fee if defined, or use 20% as a general rule if that's the business model.
    // Based on frontend: (stats.revenue?.total || 0) * 0.8 is shown as "Pending Amount" for Superadmin.
    // This implies Venue Share is 80% and Platform Share is 20%.

    const matchAdminShare = matchRevenue * 0.8;
    const matchSuperAdminShare = matchRevenue * 0.2;

    const totalRevenue = bookingTotal + tournamentRevenue + matchRevenue;
    const totalPaidRevenue = bookingPaid + tournamentRevenue + matchRevenue;
    
    // Wallet revenue usually includes all online payments
    const totalWalletRevenue = walletRevenue + tournamentRevenue + matchRevenue; 
    
    // Platform Share calculation (20% of total revenue as a standard)
    const platformShare = totalRevenue * 0.2;
    const venueShare = totalRevenue * 0.8;
    
    // Total Wallet Share (80% of online revenue goes to venue, 20% to platform)
    const totalVenueWalletShare = totalWalletRevenue * 0.8;
    const pendingSettlements = totalVenueWalletShare - settlementsPaid;

    // Get all turfs
    const recentTurfs = await Turf.find(turfQuery)
      .sort("-createdAt")
      .populate("owner", "name email")
      .limit(5);

    // Get all users
    const recentUsers = await User.find(userQuery)
      .sort("-createdAt")
      .select("-password")
      .limit(5);

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
          total: totalRevenue, // Total business value
          paid: totalPaidRevenue, // Actual cash received
          platformShare, // Platform's 20%
          venueShare, // Venues' 80%
          pendingSettlements: Math.max(0, pendingSettlements), // Amount yet to be paid to venues
          settlementsPaid, // Amount already paid to venues
          bookings: bookingTotal,
          tournaments: tournamentRevenue,
          matches: {
            total: matchRevenue,
            adminShare: matchAdminShare,
            superAdminShare: matchSuperAdminShare
          },
          wallet: totalWalletRevenue,
          offline: offlineRevenue
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
      Booking.countDocuments({ status: { $in: ["confirmed", "completed"] } }),
      Turf.find({ status: "approved" }).select("location.city")
    ]);

    const uniqueCities = [...new Set(turfsWithCities.map(t => t.location?.city).filter(Boolean))];
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

// @desc    Get aggregated data for App Home Screen
// @route   GET /api/dashboard/app-home
// @access  Public
export const getAppHomeData = async (req, res) => {
  try {
    const [
      totalTurfs,
      totalUsers,
      totalBookings,
      turfsWithCities,
      featuredTurfs,
      upcomingTournaments,
      sports
    ] = await Promise.all([
      Turf.countDocuments({ status: "approved" }),
      User.countDocuments({ role: "user" }),
      Booking.countDocuments({ status: { $in: ["confirmed", "completed"] } }),
      Turf.find({ status: "approved" }).select("location.city"),
      Turf.find({ status: "approved" })
        .sort("-rating -createdAt")
        .limit(10)
        .select("name location pricePerHour rating images sports sportConfigs"),
      Tournament.find({ approvalStatus: "approved", status: { $ne: "finished" } })
        .sort("startDate")
        .limit(6)
        .select("title tournamentName sport type startDate endDate location registrationFee images"),
      Master.find({ category: "sport", isActive: true }).select("name image")
    ]);

    const baseUrl = process.env.BASE_URL || "";

    const processImage = (img) => {
      if (!img) return "";
      if (img.startsWith("http")) return img;
      return `${baseUrl}${img.startsWith("/") ? "" : "/"}${img}`;
    };

    const processedFeaturedTurfs = featuredTurfs.map(t => {
      let featuredImage = "";
      if (t.images && t.images.length > 0) {
        featuredImage = processImage(t.images[0]);
      } else if (t.sportConfigs && t.sportConfigs.length > 0) {
        const firstConfigWithImage = t.sportConfigs.find(c => c.images && c.images.length > 0);
        if (firstConfigWithImage) {
          featuredImage = processImage(firstConfigWithImage.images[0]);
        }
      }

      return {
        ...t._doc,
        featuredImage,
        images: (t.images || []).map(processImage)
      };
    });

    const processedTournaments = upcomingTournaments.map(t => ({
      ...t._doc,
      images: (t.images || []).map(processImage),
      featuredImage: t.images && t.images.length > 0 ? processImage(t.images[0]) : ""
    }));

    const processedSports = sports.map(s => ({
      ...s._doc,
      image: processImage(s.image)
    }));

    const uniqueCities = [...new Set(turfsWithCities.map(t => t.location?.city).filter(Boolean))];
    
    res.json({
      success: true,
      data: {
        stats: {
          grounds: totalTurfs,
          players: totalUsers,
          cities: uniqueCities.length,
          bookings: totalBookings
        },
        cities: uniqueCities.sort(),
        sports: processedSports,
        featuredTurfs: processedFeaturedTurfs,
        upcomingTournaments: processedTournaments
      }
    });
  } catch (err) {
    console.error("Get App Home Data Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

