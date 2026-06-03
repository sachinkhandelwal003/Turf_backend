import mongoose from "mongoose";
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
      turfQuery["_id"] = new mongoose.Types.ObjectId(turfId);
    }

    // Get turf IDs for filtering bookings
    const filteredTurfs = await Turf.find(turfQuery).select('_id');
    const filteredTurfIds = filteredTurfs.map(t => new mongoose.Types.ObjectId(t._id));

    console.log('🔍 Converted Turf IDs (ObjectId):', filteredTurfIds);

    // Filter bookings based on filtered turfs
    let bookingQuery = {};
    if (!isSuperadmin || city || turfId) {
      bookingQuery = { turf: { $in: filteredTurfIds } };
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
      Booking.countDocuments({ ...bookingQuery, status: { $in: ["confirmed", "completed"] } }),
      Booking.countDocuments({ ...bookingQuery, status: "pending" }),
      Booking.countDocuments({ ...bookingQuery, status: "cancelled" }),
      Tournament.countDocuments(tournamentQuery),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: { $in: ["pending", null, undefined] } }),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: "approved" }),
      Tournament.countDocuments({ ...tournamentQuery, approvalStatus: "rejected" })
    ]);

    console.log('🔍 Dashboard Filters:', { isSuperadmin, userId, city, turfId });
    console.log('🔍 Turf Query:', turfQuery);
    console.log('🔍 Filtered Turf IDs:', filteredTurfIds);
    console.log('🔍 Booking Query:', bookingQuery);

    // Calculate Booking Revenue using Aggregation (Efficient & Dynamic)
    const bookingRevenueResult = await Booking.aggregate([
      { $match: { ...bookingQuery, status: { $in: ["confirmed", "completed"] } } },
      { 
        $group: { 
          _id: null, 
          total: { $sum: { $ifNull: ["$totalAmount", "$price"] } }, 
          paid: { $sum: "$paidAmount" },
          offline: { 
            $sum: { $cond: [{ $eq: ["$isOffline", true] }, { $ifNull: ["$totalAmount", "$price"] }, 0] } 
          },
          wallet: { 
            $sum: { $cond: [{ $ne: ["$isOffline", true] }, { $ifNull: ["$totalAmount", "$price"] }, 0] } 
          }
        } 
      }
    ]);

    console.log('📊 Booking Revenue Result:', bookingRevenueResult);

    const bookingTotal = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].total : 0;
    const bookingPaid = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].paid : 0;
    const offlineRevenue = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].offline : 0;
    const walletRevenue = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].wallet : 0;

    // Calculate Tournament Revenue using Aggregation (More efficient than forEach)
    const tournamentRevenueResult = await Tournament.aggregate([
      { $match: tournamentQuery },
      { $unwind: "$registeredTeams" },
      { $match: { "registeredTeams.status": "confirmed" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$registeredTeams.paymentDetails.amount" }
        }
      }
    ]);

    console.log('📊 Tournament Revenue Result:', tournamentRevenueResult);

    const tournamentRevenue = tournamentRevenueResult.length > 0 ? tournamentRevenueResult[0].total : 0;

    // Calculate Match Revenue using Aggregation
    let matchQuery = {};
    if (!isSuperadmin || city || turfId) {
      matchQuery = { turf: { $in: filteredTurfIds } };
    }
    console.log('🔍 Match Query:', { ...matchQuery, status: { $in: ["confirmed", "completed", "full", "open"] } });
    
    const matchRevenueResult = await Match.aggregate([
      { $match: { ...matchQuery, status: { $in: ["confirmed", "completed", "full", "open"] } } },
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
          total: { $sum: { $multiply: ["$confirmedPlayersCount", "$pricePerPlayer"] } }
        }
      }
    ]);
    
    console.log('📊 Match Revenue Result:', matchRevenueResult);

    const matchRevenue = matchRevenueResult.length > 0 ? matchRevenueResult[0].total : 0;
    const matchAdminShare = matchRevenue * 0.8;
    const matchSuperAdminShare = matchRevenue * 0.2;

    const totalRevenue = bookingTotal + tournamentRevenue + matchRevenue;
    const totalPaidRevenue = bookingPaid + tournamentRevenue + matchRevenue;
    const totalWalletRevenue = walletRevenue + tournamentRevenue + matchRevenue; 

    // Calculate platform split
    const platformShare = totalRevenue * 0.2; // Superadmin share (20%)
    const venueShare = totalRevenue * 0.8; // Venue owners share (80%)

    // Calculate settlement amounts
    let settlementQuery = {};
    // For admin: filter settlements where admin is the user
    if (!isSuperadmin) {
      settlementQuery = { admin: userId };
    }
    console.log('🔍 Settlement Query:', settlementQuery);
    
    const settlementsResult = await Settlement.aggregate([
      { $match: settlementQuery },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$type", "payout"] }, { $eq: ["$status", "completed"] }] },
                "$amount",
                0
              ]
            }
          },
          totalPending: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$type", "payout"] }, { $eq: ["$status", "pending"] }] },
                "$amount",
                0
              ]
            }
          }
        }
      }
    ]);
    
    console.log('📊 Settlements Result:', settlementsResult);

    const totalPaidSettlements = settlementsResult.length > 0 ? settlementsResult[0].totalPaid : 0;
    const totalPendingSettlements = settlementsResult.length > 0 ? settlementsResult[0].totalPending : 0;
    const pendingToSettle = (totalWalletRevenue * 0.8) - totalPaidSettlements;

    console.log('💵 Final Revenue Breakdown:', {
      bookingTotal,
      tournamentRevenue,
      matchRevenue,
      totalRevenue,
      platformShare,
      venueShare,
      totalPaidSettlements,
      totalPendingSettlements,
      pendingToSettle
    });

    // Get all turfs
    const recentTurfs = await Turf.find(turfQuery)
      .sort("-createdAt")
      .populate("owner", "name email");

    // Get all users
    const recentUsers = await User.find(userQuery)
      .sort("-createdAt")
      .select("-password");

    // Get all bookings
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
          total: totalRevenue, // Total business value (totalAmount)
          paid: totalPaidRevenue, // Actual cash received (paidAmount)
          bookings: bookingTotal,
          tournaments: tournamentRevenue,
          matches: {
            total: matchRevenue,
            adminShare: matchAdminShare,
            superAdminShare: matchSuperAdminShare
          },
          wallet: totalWalletRevenue,
          offline: offlineRevenue,
          platformShare: platformShare,
          venueShare: venueShare,
          settlements: {
            paid: totalPaidSettlements,
            pending: totalPendingSettlements,
            pendingToSettle: pendingToSettle
          }
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
      Turf.countDocuments(),
      User.countDocuments(),
      Booking.countDocuments(),
      Turf.find().select("location.city")
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
      Turf.countDocuments(),
      User.countDocuments(),
      Booking.countDocuments(),
      Turf.find().select("location.city"),
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

