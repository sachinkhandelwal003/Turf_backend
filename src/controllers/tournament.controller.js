import Tournament from "../models/tournament.model.js";

// @desc    Create a new tournament
// @route   POST /api/tournaments
// @access  Private (Superadmin/Admin)
export const createTournament = async (req, res) => {
  try {
    const body = { ...req.body };

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        body.image = `/uploads/${req.files.image[0].filename}`;
      }
      if (req.files.gallery) {
        body.gallery = req.files.gallery.map(file => `/uploads/${file.filename}`);
      }
    }

    // Parse JSON strings for nested objects if they come from multipart/form-data
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

    const tournament = await Tournament.create({
      ...body,
      owner: req.user.id,
      approvalStatus: req.user.role === 'superadmin' ? 'approved' : 'pending',
      approvedBy: req.user.role === 'superadmin' ? req.user.id : null,
      approvedAt: req.user.role === 'superadmin' ? new Date() : null,
    });

    res.status(201).json({
      success: true,
      message: "Tournament created successfully",
      tournament,
    });
  } catch (err) {
    console.error("Create Tournament Error:", err);
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
// @access  Private (Superadmin)
export const approveTournament = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ msg: "Tournament not found" });
    }

    tournament.approvalStatus = status;
    tournament.approvedBy = req.user.id;
    tournament.approvedAt = new Date();
    await tournament.save();

    res.json({ 
      success: true, 
      message: `Tournament ${status} successfully`,
      tournament 
    });
  } catch (err) {
    console.error("Approve Tournament Error:", err);
    res.status(500).json({ error: "Server Error" });
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
        body.image = `/uploads/${req.files.image[0].filename}`;
      }
      if (req.files.gallery) {
        const newGallery = req.files.gallery.map(file => `/uploads/${file.filename}`);
        
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
