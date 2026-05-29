import Match from "../models/match.model.js";
import Turf from "../models/turf.model.js";

// @desc    Create a new match for hosting
// @route   POST /api/matches
// @access  Private
export const createMatch = async (req, res) => {
  try {
    const {
      turf,
      title,
      description,
      sport,
      date,
      startTime,
      endTime,
      totalPlayersNeeded,
      pricePerPlayer,
      isPrivate
    } = req.body;

    // Validate required fields
    if (!turf || !title || !sport || !date || !startTime || !endTime || !totalPlayersNeeded) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields"
      });
    }

    // Check if turf exists
    const turfExists = await Turf.findById(turf);
    if (!turfExists) {
      return res.status(404).json({
        success: false,
        message: "Turf not found"
      });
    }

    const match = await Match.create({
      host: req.user.id,
      turf,
      title,
      description,
      sport,
      date,
      startTime,
      endTime,
      totalPlayersNeeded,
      pricePerPlayer,
      isPrivate,
      joinedPlayers: [{ user: req.user.id, status: "confirmed" }]
    });

    res.status(201).json({
      success: true,
      message: "Match created successfully",
      match
    });
  } catch (error) {
    console.error("Create Match Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error"
    });
  }
};

// @desc    Get all open matches
// @route   GET /api/matches
// @access  Public
export const getMatches = async (req, res) => {
  try {
    const { sport, date, city } = req.query;
    let query = { status: "open", isPrivate: false };

    if (sport) query.sport = sport;
    if (date) query.date = date;

    const matches = await Match.find(query)
      .populate("host", "name profilePhoto")
      .populate("turf", "name location images")
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: matches.length,
      matches
    });
  } catch (error) {
    console.error("Get Matches Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Public
export const getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate("host", "name profilePhoto phone")
      .populate("turf", "name location images pricePerHour")
      .populate("joinedPlayers.user", "name profilePhoto");

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found"
      });
    }

    res.status(200).json({
      success: true,
      match
    });
  } catch (error) {
    console.error("Get Match By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// @desc    Join a match
// @route   POST /api/matches/:id/join
// @access  Private
export const joinMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found"
      });
    }

    if (match.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Match is no longer open"
      });
    }

    // Check if user is already in the match
    const alreadyJoined = match.joinedPlayers.some(
      (p) => p.user.toString() === req.user.id
    );

    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: "You have already joined this match"
      });
    }

    match.joinedPlayers.push({ user: req.user.id, status: "confirmed" });

    // Update status if full
    if (match.joinedPlayers.length >= match.totalPlayersNeeded) {
      match.status = "full";
    }

    await match.save();

    res.status(200).json({
      success: true,
      message: "Joined match successfully",
      match
    });
  } catch (error) {
    console.error("Join Match Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// @desc    Get matches for admin panel (role-based)
// @route   GET /api/matches/admin
// @access  Private (Admin/Superadmin)
export const getAdminMatches = async (req, res) => {
  try {
    let query = {};

    // If not superadmin, only show matches for turfs owned by this user
    if (req.user.role !== "superadmin") {
      const myTurfs = await Turf.find({ owner: req.user.id }).select("_id");
      const turfIds = myTurfs.map(t => t._id);
      query.turf = { $in: turfIds };
    }

    const matches = await Match.find(query)
      .populate("host", "name profilePhoto phone")
      .populate("turf", "name location owner")
      .populate("joinedPlayers.user", "name profilePhoto phone")
      .sort({ createdAt: -1 });

    // Calculate revenue and shares for each match
    const matchesWithRevenue = matches.map(match => {
      const confirmedPlayers = match.joinedPlayers.filter(p => p.status === "confirmed").length;
      const totalRevenue = confirmedPlayers * match.pricePerPlayer;
      const adminShare = totalRevenue * 0.8;
      const superAdminShare = totalRevenue * 0.2;
      
      return {
        ...match.toObject(),
        revenue: {
          total: totalRevenue,
          adminShare,
          superAdminShare,
          confirmedPlayers
        }
      };
    });

    res.status(200).json({
      success: true,
      count: matches.length,
      matches: matchesWithRevenue
    });
  } catch (error) {
    console.error("Get Admin Matches Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};
