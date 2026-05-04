import Turf from "../models/turf.model.js";

// @desc    Create a new turf
// @route   POST /api/turfs
// @access  Private (Admin/Superadmin)
export const createTurf = async (req, res) => {
  try {
    const body = { ...req.body };

    // Validation
    if (!body.name || !body.pricePerHour) {
      return res.status(400).json({ error: "Name and Price per hour are required" });
    }

    // Handle multiple image uploads
    if (req.files && req.files.length > 0) {
      body.images = req.files.map((file) => `/uploads/${file.filename}`);
    } else if (body.existingImages) {
      try {
        body.images = JSON.parse(body.existingImages);
      } catch (e) {
        body.images = [];
      }
    } else {
      body.images = [];
    }

    // Remove existingImages from body
    delete body.existingImages;

    // Parse JSON strings for nested objects and arrays if they come from multipart/form-data
    const fieldsToParse = ["location", "sports", "amenities", "rates", "operatingHours", "availableSlots", "courts", "unavailableDates", "rating", "reviewsCount"];
    fieldsToParse.forEach((field) => {
      if (typeof body[field] === "string" && body[field].trim() !== "") {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          console.warn(`Failed to parse field ${field}:`, e.message);
        }
      }
    });

    const turf = await Turf.create({
      ...body,
      owner: req.user.id,
    });

    res.status(201).json({ 
      success: true, 
      message: "Turf created successfully",
      turf 
    });
  } catch (err) {
    console.error("Create Turf Error:", err);
    res.status(500).json({ error: err.message || "Server Error while creating turf" });
  }
};

// @desc    Get all turfs for the logged-in owner/admin
// @route   GET /api/turfs/my-turfs
// @access  Private (Admin/Superadmin)
export const getMyTurfs = async (req, res) => {
  try {
    const turfs = await Turf.find({ owner: req.user.id }).sort("-createdAt");
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
    const { city, sport, minPrice, maxPrice, rating } = req.query;
    
    let query = { isActive: true };

    if (city) query["location.city"] = new RegExp(city, "i");
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
    if (turf.owner.toString() !== req.user.id && req.user.role !== "superadmin") {
      return res.status(401).json({ msg: "Not authorized to update this turf" });
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

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => `/uploads/${file.filename}`);
      body.images = [...currentImages, ...newImages];
    } else {
      body.images = currentImages;
    }

    // Remove existingImages from body
    delete body.existingImages;

    // Parse JSON strings for nested objects and arrays
    const fieldsToParse = ["location", "sports", "amenities", "rates", "operatingHours", "availableSlots", "courts", "unavailableDates", "rating", "reviewsCount"];
    fieldsToParse.forEach((field) => {
      if (typeof body[field] === "string" && body[field].trim() !== "") {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          console.warn(`Failed to parse field ${field}:`, e.message);
        }
      }
    });

    // Remove appendImages from body before saving to DB
    delete body.appendImages;

    turf = await Turf.findByIdAndUpdate(req.params.id, body, { 
      new: true,
      runValidators: true 
    });

    res.json({ 
      success: true, 
      message: "Turf updated successfully",
      turf 
    });
  } catch (err) {
    console.error("Update Turf Error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
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
    if (turf.owner.toString() !== req.user.id && req.user.role !== "superadmin") {
      return res.status(401).json({ msg: "Not authorized to delete this turf" });
    }

    await turf.deleteOne();
    res.json({ success: true, message: "Turf deleted successfully" });
  } catch (err) {
    console.error("Delete Turf Error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
};
