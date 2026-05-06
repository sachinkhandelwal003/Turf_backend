import Turf from "../models/turf.model.js";

// @desc    Create a new turf
// @route   POST /api/turfs
// @access  Private (Admin/Superadmin)
export const createTurf = async (req, res) => {
  try {
    const body = { ...req.body };

    // Validation
    if (!body.name || body.pricePerHour === undefined || body.pricePerHour === "") {
      return res.status(400).json({ error: "Name and Price per hour are required" });
    }

    // Handle multiple image uploads
    if (req.files) {
      if (req.files.images) {
        body.images = req.files.images.map((file) => `/uploads/${file.filename}`);
      }
      if (req.files.logo) {
        body.logo = `/uploads/${req.files.logo[0].filename}`;
      }
    }

    if (body.existingImages) {
      try {
        const existing = JSON.parse(body.existingImages);
        body.images = [...(body.images || []), ...existing];
      } catch (e) {
        // ignore
      }
    }

    if (!body.images) body.images = [];
    if (!body.logo) body.logo = "";

    // Remove existingImages from body
    delete body.existingImages;

    // Parse JSON strings for nested objects and arrays if they come from multipart/form-data
    const fieldsToParse = ["location", "sports", "amenities", "rates", "operatingHours", "availableSlots", "courts", "unavailableDates", "rating", "reviewsCount", "priceHikes"];
    fieldsToParse.forEach((field) => {
      if (body[field] && typeof body[field] === "string" && body[field].trim() !== "") {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          console.warn(`Failed to parse field ${field}:`, e.message);
        }
      }
    });

    // Ensure pricePerHour and peakHourSurcharge are numbers
    if (body.pricePerHour !== undefined && body.pricePerHour !== "") {
      body.pricePerHour = Number(body.pricePerHour);
    }
    if (body.peakHourSurcharge !== undefined && body.peakHourSurcharge !== "") {
      body.peakHourSurcharge = Number(body.peakHourSurcharge);
    }

    const turf = await Turf.create({
      ...body,
      owner: req.user.id,
      status: req.user.role === "superadmin" ? "approved" : "pending",
      approvedBy: req.user.role === "superadmin" ? req.user.id : null,
      approvedAt: req.user.role === "superadmin" ? new Date() : null,
    });

    res.status(201).json({ 
      success: true, 
      message: "Turf created successfully",
      turf 
    });
  } catch (err) {
    console.error("Create Turf Error:", err);
    // Return specific validation errors if available
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        error: Object.values(err.errors).map(val => val.message).join(', ') 
      });
    }
    res.status(500).json({ error: err.message || "Server Error while creating turf" });
  }
};

// @desc    Get all turfs for the logged-in owner/admin
// @route   GET /api/turfs/my/all
// @access  Private (Admin/Superadmin)
export const getMyTurfs = async (req, res) => {
  try {
    let query = { owner: req.user.id };
    
    // Superadmin can see all turfs
    if (req.user.role === "superadmin") {
      query = {};
    }

    const turfs = await Turf.find(query).sort("-createdAt").populate("owner", "name email");
    res.json({ success: true, count: turfs.length, turfs });
  } catch (err) {
    console.error("Get My Turfs Error:", err);
    res.status(500).json({ error: "Server Error while fetching your turfs" });
  }
};

// @desc    Get all turfs with filters
// @route   GET /api/turfs
// @access  Public
export const getTurfs = async (req, res) => {
  try {
    const { city, location, sport, minPrice, maxPrice, rating } = req.query;
    
    let query = { isActive: true, status: "approved" };

    // Search by city or location across multiple fields
    const searchLocation = city || location;
    if (searchLocation) {
      query.$or = [
        { "location.city": new RegExp(searchLocation, "i") },
        { "location.address": new RegExp(searchLocation, "i") },
        { "location.landmark": new RegExp(searchLocation, "i") }
      ];
    }

    if (sport) query.sports = sport;
    if (minPrice || maxPrice) {
      query.pricePerHour = {};
      if (minPrice) query.pricePerHour.$gte = Number(minPrice);
      if (maxPrice) query.pricePerHour.$lte = Number(maxPrice);
    }
    if (rating) query.rating = { $gte: Number(rating) };

    const turfs = await Turf.find(query).populate("owner", "name email");
    res.json({ success: true, count: turfs.length, turfs });
  } catch (err) {
    console.error("Get Turfs Error:", err);
    res.status(500).json({ error: "Server Error while fetching turfs" });
  }
};

// @desc    Get single turf
// @route   GET /api/turfs/:id
// @access  Public
export const getTurfById = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id).populate("owner", "name email");
    if (!turf) {
      return res.status(404).json({ msg: "Turf not found" });
    }
    
    // If user is logged in as admin (and not superadmin), 
    // we can still let them SEE it because it's public, 
    // but the list and edit forms should only show their own.
    
    res.json({ success: true, turf });
  } catch (err) {
    console.error("Get Turf Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Update turf
// @route   PUT /api/turfs/:id
// @access  Private (Owner/Superadmin)
export const updateTurf = async (req, res) => {
  try {
    let turf = await Turf.findById(req.params.id);
    if (!turf) return res.status(404).json({ msg: "Turf not found" });

    // Check ownership
    if (req.user.role !== "superadmin" && turf.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to update this turf" });
    }

    const body = { ...req.body };

    // Handle image updates
    let currentImages = [];
    if (body.existingImages) {
      try {
        currentImages = JSON.parse(body.existingImages);
      } catch (e) {
        currentImages = turf.images || [];
      }
    } else {
      currentImages = turf.images || [];
    }

    if (req.files) {
      if (req.files.images) {
        const newImages = req.files.images.map((file) => `/uploads/${file.filename}`);
        body.images = [...currentImages, ...newImages];
      } else {
        body.images = currentImages;
      }

      if (req.files.logo) {
        body.logo = `/uploads/${req.files.logo[0].filename}`;
      }
    } else {
      body.images = currentImages;
    }

    // Remove existingImages from body
    delete body.existingImages;

    // Parse JSON strings for nested objects and arrays
    const fieldsToParse = ["location", "sports", "amenities", "rates", "operatingHours", "availableSlots", "courts", "unavailableDates", "rating", "reviewsCount", "priceHikes"];
    fieldsToParse.forEach((field) => {
      if (body[field] && typeof body[field] === "string" && body[field].trim() !== "") {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          console.warn(`Failed to parse field ${field}:`, e.message);
        }
      }
    });

    // Ensure pricePerHour and peakHourSurcharge are numbers
    if (body.pricePerHour !== undefined && body.pricePerHour !== "") {
      body.pricePerHour = Number(body.pricePerHour);
    }
    if (body.peakHourSurcharge !== undefined && body.peakHourSurcharge !== "") {
      body.peakHourSurcharge = Number(body.peakHourSurcharge);
    }

    // Remove appendImages from body before saving to DB
    delete body.appendImages;

    const updatedTurf = await Turf.findByIdAndUpdate(req.params.id, body, { 
      new: true,
      runValidators: true 
    });

    res.json({ 
      success: true, 
      message: "Turf updated successfully",
      turf: updatedTurf 
    });
  } catch (err) {
    console.error("Update Turf Error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
};

// @desc    Approve or reject a turf
// @route   PATCH /api/turfs/:id/status
// @access  Private (Superadmin)
export const updateTurfStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const turf = await Turf.findById(req.params.id);
    if (!turf) {
      return res.status(404).json({ error: "Turf not found" });
    }

    turf.status = status;
    if (status === "approved") {
      turf.approvedBy = req.user.id;
      turf.approvedAt = new Date();
    }

    await turf.save();

    res.json({
      success: true,
      message: `Turf ${status} successfully`,
      turf
    });
  } catch (err) {
    console.error("Update Turf Status Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Delete turf
// @route   DELETE /api/turfs/:id
// @access  Private (Owner/Superadmin)
export const deleteTurf = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id);
    if (!turf) return res.status(404).json({ msg: "Turf not found" });

    // Check ownership
    if (req.user.role !== "superadmin" && turf.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to delete this turf" });
    }

    await turf.deleteOne();
    res.json({ success: true, message: "Turf deleted successfully" });
  } catch (err) {
    console.error("Delete Turf Error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
};
