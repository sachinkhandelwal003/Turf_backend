import Tournament from "../models/tournament.model.js";
import User from "../models/auth/user.model.js";

// @desc    Create a new tournament
// @route   POST /api/tournaments
// @access  Private (Superadmin/Admin)
export const createTournament = async (req, res) => {
  try {
    console.log("Create Tournament Request Body:", req.body);
    const body = { ...req.body };

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        body.image = req.files.image[0].path || req.files.image[0].secure_url;
      }
      if (req.files.gallery) {
        body.gallery = req.files.gallery.map(file => file.path || file.secure_url);
      }
    }

    // Parse JSON strings for nested objects if they come from multipart/form-data
    const fieldsToParse = ["location", "prizes", "contact", "rules", "crucialDetails"];
    fieldsToParse.forEach((field) => {
      if (body[field] && typeof body[field] === "string" && body[field].trim() !== "") {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          console.warn(`Failed to parse field ${field}:`, e.message);
        }
      }
    });

    console.log("Creating tournament with parsed body:", body);

    const tournament = await Tournament.create({
      ...body,
      owner: req.user.id,
      approvalStatus: 'approved', // Auto-approve for now so it shows on home page
      approvedBy: req.user.id,
      approvedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Tournament created successfully",
      tournament,
    });
  } catch (err) {
    console.error("Create Tournament Error Details:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        error: Object.values(err.errors).map(val => val.message).join(', ') 
      });
    }
    res.status(500).json({ error: err.message || "Server Error while creating tournament" });
  }
};

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Public
export const getTournaments = async (req, res) => {
  try {
    const { status, sport } = req.query;
    let query = { isActive: true, approvalStatus: 'approved' };

    if (status) query.status = status;
    if (sport) query.sport = sport;

    const tournaments = await Tournament.find(query).sort("startDate").populate("owner", "name email role");
    res.json({ success: true, count: tournaments.length, tournaments });
  } catch (err) {
    console.error("Get Tournaments Error:", err);
    res.status(500).json({ error: "Server Error while fetching tournaments" });
  }
};

// @desc    Get all tournaments for the logged-in owner/admin
// @route   GET /api/tournaments/my/all
// @access  Private (Admin/Superadmin)
export const getMyTournaments = async (req, res) => {
  try {
    let query = { owner: req.user.id };
    
    // Superadmin can see all tournaments
    if (req.user.role === "superadmin") {
      query = {};
    }

    const tournaments = await Tournament.find(query).sort("-createdAt").populate("owner", "name email");
    res.json({ success: true, count: tournaments.length, tournaments });
  } catch (err) {
    console.error("Get My Tournaments Error:", err);
    res.status(500).json({ error: "Server Error while fetching your tournaments" });
  }
};

// @desc    Approve/Reject tournament
// @route   PATCH /api/tournaments/:id/approve
// @access  Private (Superadmin/Admin)
export const approveTournament = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // Update using findByIdAndUpdate to avoid potential validation issues with old data
    const updatedTournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          approvalStatus: status,
          approvedBy: req.user.id,
          approvedAt: new Date()
        }
      },
      { new: true }
    );

    res.json({ 
      success: true, 
      message: `Tournament ${status} successfully`,
      tournament: updatedTournament 
    });
  } catch (err) {
    console.error("Approve Tournament Error:", err);
    res.status(500).json({ error: err.message || "Server Error during tournament approval" });
  }
};

// @desc    Get single tournament
// @route   GET /api/tournaments/:id
// @access  Public
export const getTournamentById = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate("owner", "name email role");
    if (!tournament) {
      return res.status(404).json({ msg: "Tournament not found" });
    }
    res.json({ success: true, tournament });
  } catch (err) {
    console.error("Get Tournament Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Update tournament
// @route   PUT /api/tournaments/:id
// @access  Private (Superadmin/Admin)
export const updateTournament = async (req, res) => {
  try {
    let tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ msg: "Tournament not found" });

    // Check ownership or superadmin
    if (req.user.role !== 'superadmin' && tournament.owner.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Not authorized to update this tournament" });
    }

    const body = { ...req.body };
    
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        body.image = req.files.image[0].path || req.files.image[0].secure_url;
      }
      if (req.files.gallery) {
        const newGallery = req.files.gallery.map(file => file.path || file.secure_url);
        
        // Handle existing gallery merging
        let finalGallery = [];
        if (body.existingGallery) {
          try {
            finalGallery = JSON.parse(body.existingGallery);
          } catch (e) {
            finalGallery = [];
          }
        }
        body.gallery = [...finalGallery, ...newGallery];
      } else if (body.existingGallery) {
        try {
          body.gallery = JSON.parse(body.existingGallery);
        } catch (e) {}
      }
    } else if (body.existingGallery) {
      // If no new files but gallery updated (images removed)
      try {
        body.gallery = JSON.parse(body.existingGallery);
      } catch (e) {}
    }

    // Parse JSON strings
    const fieldsToParse = ["location", "prizes", "contact", "rules", "crucialDetails"];
    fieldsToParse.forEach((field) => {
      if (body[field] && typeof body[field] === "string") {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          console.warn(`Failed to parse field ${field}:`, e.message);
        }
      }
    });

    tournament = await Tournament.findByIdAndUpdate(req.params.id, body, { new: true });

    res.json({ success: true, message: "Tournament updated successfully", tournament });
  } catch (err) {
    console.error("Update Tournament Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Delete tournament
// @route   DELETE /api/tournaments/:id
// @access  Private (Superadmin/Admin)
export const deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ msg: "Tournament not found" });

    // Check ownership or superadmin
    if (req.user.role !== 'superadmin' && tournament.owner.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Not authorized to delete this tournament" });
    }

    await tournament.deleteOne();
    res.json({ success: true, message: "Tournament deleted successfully" });
  } catch (err) {
    console.error("Delete Tournament Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Register for a tournament
// @route   POST /api/tournaments/:id/register
// @access  Private
export const registerTournament = async (req, res) => {
  try {
    const { teamName, captainName, email, phone, altPhone, address, members, paymentId, paymentMethod } = req.body;
    
    if (!teamName || !captainName || !phone) {
      return res.status(400).json({ error: "Team name, captain name and phone are required" });
    }

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // Check if tournament is full
    if (tournament.registeredTeams && tournament.registeredTeams.length >= (tournament.maxTeams || 16)) {
      return res.status(400).json({ error: "Tournament is full" });
    }

    // Check if team name already exists in this tournament
    const teamExists = tournament.registeredTeams.some(t => t.name.toLowerCase() === teamName.toLowerCase());
    if (teamExists) {
      return res.status(400).json({ error: "Team name already registered for this tournament" });
    }

    // Add team to registeredTeams
    const newTeam = {
      user: req.user.id,
      name: teamName,
      captain: captainName,
      email: email,
      contact: phone,
      altContact: altPhone,
      address: address,
      members: members || [],
      status: tournament.entryFee > 0 ? "confirmed" : "pending", // If fee paid, confirm immediately
      registeredAt: new Date(),
      paymentDetails: tournament.entryFee > 0 ? {
        paymentId,
        paymentMethod,
        amount: tournament.entryFee,
        paidAt: new Date()
      } : null
    };

    // Add team to registeredTeams using findByIdAndUpdate to avoid full document validation issues
    const updatedTournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $push: { registeredTeams: newTeam } },
      { new: true, runValidators: false } // runValidators: false avoids the 'owner is required' check on existing docs
    );

    if (!updatedTournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.status(201).json({
      success: true,
      msg: "Registration successful",
      team: newTeam
    });
  } catch (err) {
    console.error("Tournament Registration Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error. Please try again later." });
  }
};

// @desc    Get all tournament registrations
// @route   GET /api/tournaments/registrations/all
// @access  Private (Admin/Superadmin)
export const getAllRegistrations = async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== "superadmin") {
      query = { owner: req.user.id };
    }

    const tournaments = await Tournament.find(query)
      .select("title registeredTeams")
      .sort({ createdAt: -1 });

    const allRegistrations = tournaments.flatMap(t => 
      (t.registeredTeams || []).map(reg => ({
        ...reg.toObject(),
        tournamentTitle: t.title,
        tournamentId: t._id
      }))
    );

    // Sort by registration date descending
    allRegistrations.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

    res.json({
      success: true,
      count: allRegistrations.length,
      registrations: allRegistrations
    });
  } catch (err) {
    console.error("Get All Registrations Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error while fetching registrations" });
  }
};

// @desc    Get my tournament registrations
// @route   GET /api/tournaments/registrations/my
// @access  Private
export const getMyRegistrations = async (req, res) => {
    try {
      const user = req.user;
      const userEmail = user?.email?.toLowerCase().trim();
      const userPhone = user?.phone?.replace(/[^0-9]/g, '');

      // Search for tournaments where user has registered
      const tournaments = await Tournament.find({
        $or: [
          { "registeredTeams.user": user._id },
          { "registeredTeams.email": { $regex: new RegExp("^" + userEmail + "$", "i") } },
          { "registeredTeams.contact": userPhone },
          // Match phone without prefixes if it's 10 digits
          ...(userPhone && userPhone.length >= 10 ? [
            { "registeredTeams.contact": { $regex: new RegExp(userPhone.slice(-10) + "$") } }
          ] : [])
        ]
      }).select("title sport image location startDate registeredTeams");

      const myRegistrations = [];
      
      tournaments.forEach(t => {
        const userRegs = t.registeredTeams.filter(reg => {
          const regEmail = reg.email?.toLowerCase().trim();
          const regPhone = reg.contact?.replace(/[^0-9]/g, '');
          
          const emailMatch = userEmail && regEmail === userEmail;
          const phoneMatch = userPhone && (regPhone === userPhone || (userPhone.length >= 10 && regPhone && regPhone.endsWith(userPhone.slice(-10))));
          const userMatch = reg.user && reg.user.toString() === user._id.toString();

          return userMatch || emailMatch || phoneMatch;
        });
        
        userRegs.forEach(reg => {
          // Avoid duplicates if same registration matches multiple criteria
          const isDuplicate = myRegistrations.some(existing => 
            existing._id.toString() === reg._id.toString()
          );
          
          if (!isDuplicate) {
            myRegistrations.push({
              ...reg.toObject(),
              tournamentId: t._id,
              tournamentTitle: t.title,
              tournamentImage: t.image,
              sport: t.sport,
              location: t.location?.city || t.location?.venue || (typeof t.location === 'string' ? t.location : 'N/A'),
              startDate: t.startDate,
              entryFee: t.entryFee,
              price: t.entryFee,
              paidAmount: reg.paymentDetails?.amount || t.entryFee
            });
          }
        });
      });

    // Sort by registration date descending
    myRegistrations.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

    res.json({
      success: true,
      count: myRegistrations.length,
      registrations: myRegistrations
    });
  } catch (err) {
    console.error("Get My Registrations Error:", err);
    res.status(500).json({ error: "Server Error while fetching your registrations" });
  }
};

// @desc    Delete a tournament registration
// @route   DELETE /api/tournaments/:tournamentId/registrations/:registrationId
// @access  Private (Admin/Superadmin)
export const deleteRegistration = async (req, res) => {
  try {
    const { tournamentId, registrationId } = req.params;

    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // Check authorization: Superadmin, Tournament Owner, or the User who registered
    const registration = tournament.registeredTeams.id(registrationId);
    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    const isTournamentOwner = tournament.owner.toString() === req.user.id;
    const isRegistrationOwner = registration.user && registration.user.toString() === req.user.id;

    if (!isSuperAdmin && !isTournamentOwner && !isRegistrationOwner) {
        return res.status(403).json({ error: "Not authorized to delete this registration" });
    }

    // Pull the registration from registeredTeams
    const updatedTournament = await Tournament.findByIdAndUpdate(
      tournamentId,
      { $pull: { registeredTeams: { _id: registrationId } } },
      { new: true }
    );

    if (!updatedTournament) {
      return res.status(404).json({ error: "Failed to delete registration" });
    }

    res.json({
      success: true,
      message: "Registration deleted successfully"
    });
  } catch (err) {
    console.error("Delete Registration Error:", err);
    res.status(500).json({ error: err.message || "Server Error while deleting registration" });
  }
};
