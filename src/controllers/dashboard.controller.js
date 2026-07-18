import mongoose from "mongoose";
import User from "../models/auth/user.model.js";
import Turf from "../models/turf.model.js";
import Role from "../models/auth/role.model.js";
import Booking from "../models/booking.model.js";
import Tournament from "../models/tournament.model.js";
import Master from "../models/master.model.js";
import Match from "../models/match.model.js";
import Settlement from "../models/settlement.model.js";
import Refund from "../models/refund.model.js";

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
    const filteredTurfs = await Turf.find(turfQuery).select('_id owner');
    const filteredTurfIds = filteredTurfs.map(t => new mongoose.Types.ObjectId(t._id));

    console.log('🔍 Converted Turf IDs (ObjectId):', filteredTurfIds);

    // Filter bookings based on filtered turfs ALWAYS (so "All Grounds" matches the sum of active grounds)
    let bookingQuery = { turf: { $in: filteredTurfIds } };

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
          },
          ownerShareSum: { $sum: { $ifNull: ["$ownerShare", { $multiply: [{ $ifNull: ["$price", "$totalAmount"] }, 0.8] }] } },
          adminCommissionSum: { $sum: { $ifNull: ["$adminCommission", { $multiply: [{ $ifNull: ["$price", "$totalAmount"] }, 0.2] }] } },
          convenienceFeeSum: { $sum: { $ifNull: ["$convenienceFee", 0] } },
          walletOwnerShareSum: { 
            $sum: { 
              $cond: [
                { $ne: ["$isOffline", true] }, 
                { $ifNull: ["$ownerShare", { $multiply: [{ $ifNull: ["$price", "$totalAmount"] }, 0.8] }] }, 
                0
              ] 
            } 
          }
        } 
      }
    ]);

    console.log('📊 Booking Revenue Result:', bookingRevenueResult);

    const bookingTotal = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].total : 0;
    const bookingPaid = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].paid : 0;
    const offlineRevenue = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].offline : 0;
    const walletRevenue = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].wallet : 0;
    const bookingOwnerShare = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].ownerShareSum : 0;
    const bookingAdminCommission = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].adminCommissionSum : 0;
    const bookingConvenienceFee = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].convenienceFeeSum : 0;
    const walletOwnerShare = bookingRevenueResult.length > 0 ? bookingRevenueResult[0].walletOwnerShareSum : 0;

    // Calculate Tournament Revenue using Aggregation (More efficient than forEach)
    let tournamentRevenue = 0;
    if (!turfId) { // Only add tournament revenue if not viewing a specific turf
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
      tournamentRevenue = tournamentRevenueResult.length > 0 ? tournamentRevenueResult[0].total : 0;
    }

    // Calculate Match Revenue using Aggregation
    let matchQuery = { turf: { $in: filteredTurfIds } };
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

    // Calculate Refund Stats
    let refundQuery = { status: "PROCESSED" };
    if (!isSuperadmin) {
      refundQuery.admin = userId;
    } else if (turfId || city) {
      const ownerIds = [...new Set(filteredTurfs.map(t => t.owner?.toString()).filter(Boolean))].map(id => new mongoose.Types.ObjectId(id));
      refundQuery.admin = { $in: ownerIds };
    }
    
    const refundStatsResult = await Refund.aggregate([
      { $match: refundQuery },
      {
        $group: {
          _id: null,
          totalRefunded: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const refundStats = refundStatsResult[0] || { totalRefunded: 0, count: 0 };
    refundStats.totalRefunded = Number(refundStats.totalRefunded || 0);

    const totalRevenue = bookingTotal + matchRevenue - refundStats.totalRefunded;
    const totalPaidRevenue = bookingPaid + matchRevenue - refundStats.totalRefunded;
    const totalWalletRevenue = walletRevenue + matchRevenue - refundStats.totalRefunded; 

    // Calculate platform split dynamically
    const platformShare = bookingAdminCommission + bookingConvenienceFee + matchSuperAdminShare;
    const venueShare = bookingOwnerShare + matchAdminShare - refundStats.totalRefunded;

    // Calculate settlement amounts
    let settlementQuery = {};
    if (!isSuperadmin) {
      settlementQuery = { admin: userId };
    } else if (turfId || city) {
      const ownerIds = [...new Set(filteredTurfs.map(t => t.owner?.toString()).filter(Boolean))].map(id => new mongoose.Types.ObjectId(id));
      settlementQuery = { admin: { $in: ownerIds } };
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
    const pendingToSettle = walletOwnerShare - totalPaidSettlements;

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
          refunds: {
            total: refundStats.totalRefunded,
            count: refundStats.count
          },
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
    const { latitude, longitude } = req.query;

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
        .select("title tournamentName sport type startDate endDate location registrationFee image gallery"),
      Master.find({ category: "sport", isActive: true }).select("name image")
    ]);

    const baseUrl = process.env.BASE_URL || "";

    const processImage = (img) => {
      if (!img) return "";
      if (img.startsWith("http")) return img;
      return `${baseUrl}${img.startsWith("/") ? "" : "/"}${img}`;
    };

    const processTournamentImage = (img) => {
      if (!img) return "";
      // Only keep cloud/remote images (e.g. Cloudinary) and filter out local paths or localhost
      if (img.startsWith("http") && !img.includes("localhost") && !img.includes("127.0.0.1")) {
        return img;
      }
      return "";
    };

    const CITY_COORDS_FALLBACK = {
      'bangalore': { lat: 12.9716, lng: 77.5946 },
      'bengaluru': { lat: 12.9716, lng: 77.5946 },
      'mumbai': { lat: 19.0760, lng: 72.8777 },
      'delhi': { lat: 28.6139, lng: 77.2090 },
      'new delhi': { lat: 28.6139, lng: 77.2090 },
      'kolkata': { lat: 22.5726, lng: 88.3639 },
      'chennai': { lat: 13.0827, lng: 80.2707 },
      'hyderabad': { lat: 17.3850, lng: 78.4867 },
      'pune': { lat: 18.5204, lng: 73.8567 },
      'ahmedabad': { lat: 23.0225, lng: 72.5714 },
      'jaipur': { lat: 26.9124, lng: 75.7873 },
      'surat': { lat: 21.1702, lng: 72.8311 },
      'lucknow': { lat: 26.8467, lng: 80.9462 },
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Radius of the earth in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
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

      let lat = t.location?.coordinates?.lat;
      let lng = t.location?.coordinates?.lng;

      if ((!lat || !lng) && t.location?.city) {
        const cityKey = t.location.city.toLowerCase().trim();
        const fallback = CITY_COORDS_FALLBACK[cityKey];
        if (fallback) {
          lat = fallback.lat;
          lng = fallback.lng;
        }
      }

      let distance = null;
      if (latitude && longitude && lat && lng) {
        distance = calculateDistance(Number(latitude), Number(longitude), Number(lat), Number(lng));
      }

      return {
        ...t.toObject ? t.toObject() : t._doc,
        featuredImage,
        images: (t.images || []).map(processImage),
        distance: distance !== null ? Number(distance.toFixed(1)) : null
      };
    });

    if (latitude && longitude) {
      processedFeaturedTurfs.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    const processedTournaments = upcomingTournaments.map(t => {
      const imgPath = t.image || "";
      const processedImage = processTournamentImage(imgPath);
      const processedGallery = (t.gallery || []).map(processTournamentImage).filter(Boolean);

      return {
        ...t.toObject ? t.toObject() : t._doc,
        image: processedImage,
        gallery: processedGallery,
        featuredImage: processedImage,
        images: processedImage ? [processedImage] : []
      };
    });

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

