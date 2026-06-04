import Turf from "../models/turf.model.js";
import Booking from "../models/booking.model.js";

const parseTimeToMinutes = (time) => {
  const [h, m] = (time || "00:00").split(":").map((v) => Number(v));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const formatMinutes = (mins) =>
  String(Math.floor(mins / 60)).padStart(2, "0") +
  ":" +
  String(mins % 60).padStart(2, "0");

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ==============================
// CREATE TURF
// ==============================
export const createTurf = async (req, res) => {
  try {
    const body = { ...req.body };

    if (body.interestToHost !== undefined) {
      body.interestToHost = body.interestToHost === 'true' || body.interestToHost === true;
    }

    // ==============================
    // PARSE JSON FIELDS FIRST
    // ==============================
    const fieldsToParse = [
      "location",
      "sports",
      "amenities",
      "rates",
      "operatingHours",
      "courts",
      "slotPricings",
      "sportConfigs",
    ];

    fieldsToParse.forEach((field) => {
      if (
        body[field] &&
        typeof body[field] === "string"
      ) {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (error) {
          console.warn(
            `Failed to parse ${field}`,
            error.message
          );
        }
      }
    });

    // ==============================
    // CLEANUP EMPTY FIELDS
    // ==============================
    Object.keys(body).forEach(key => {
      if (body[key] === "" || body[key] === null || body[key] === undefined) {
        delete body[key];
      }
      // Remove empty arrays for optional fields
      if (Array.isArray(body[key]) && body[key].length === 0) {
        if (["amenities", "slotPricings", "sportConfigs", "rates", "operatingHours"].includes(key)) {
          delete body[key];
        }
      }
    });

    // Validation
    if (
      !body.name ||
      body.pricePerHour === undefined
    ) {
      return res.status(400).json({
        error: "Name and price per hour are required",
      });
    }

    // ==============================
    // HANDLE IMAGES
    // ==============================
    if (req.files) {
      const logoFile = req.files.find(f => f.fieldname === 'logo');
      if (logoFile) {
        body.logo = logoFile.path || logoFile.secure_url;
      }

      const imageFiles = req.files.filter(f => f.fieldname === 'images');
      if (imageFiles.length > 0) {
        body.images = imageFiles.map(f => f.path || f.secure_url);
      }
    }

    // ==============================
    // CONVERT NUMBERS & RATE SYNC
    // ==============================
    body.pricePerHour = Number(body.pricePerHour || 0);
    const basePrice = body.pricePerHour;
    const surcharge = Number(body.peakHourSurcharge || 0);
    if (body.peakHourSurcharge !== undefined) body.peakHourSurcharge = surcharge;

    // Ensure rates are always initialized and synchronized
    const ratesToSync = Array.isArray(body.rates) && body.rates.length > 0 
      ? body.rates 
      : days.map(d => ({ day: d, isPeak: false }));

    body.rates = ratesToSync.map(rate => ({
      day: rate.day,
      isPeak: !!rate.isPeak,
      price: rate.isPeak ? (basePrice + surcharge) : basePrice
    }));

    if (body.slotDuration) body.slotDuration = Number(body.slotDuration);

    // Ensure slotPricings prices are numbers
    if (Array.isArray(body.slotPricings)) {
      body.slotPricings = body.slotPricings
        .filter(sp => sp.price > 0) // Only keep meaningful slots
        .map(sp => ({ ...sp, price: Number(sp.price) }));
      if (body.slotPricings.length === 0) delete body.slotPricings;
    }

    // Handle sportConfigs
    if (Array.isArray(body.sportConfigs)) {
      body.sportConfigs = body.sportConfigs.map(config => {
        const sportImagesKey = `sportImages_${config.sportName}`;
        let sportImages = config.images || [];

        if (req.files && Array.isArray(req.files)) {
          const newSportImages = req.files
            .filter((file) => file.fieldname === sportImagesKey)
            .map((file) => file.path || file.secure_url);
          sportImages = [...sportImages, ...newSportImages];
        }

        return {
          ...config,
          pricePerHour: Number(config.pricePerHour || 0),
          images: sportImages,
          slotPricings: Array.isArray(config.slotPricings) 
            ? config.slotPricings.filter(sp => sp.price > 0).map(sp => ({ ...sp, price: Number(sp.price) }))
            : []
        };
      });
    }

    // ==============================
    // CREATE TURF
    // ==============================
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
      turf,
    });
  } catch (err) {
    console.error("Create Turf Error:", err);

    res.status(500).json({
      error:
        err.message ||
        "Server error while creating turf",
    });
  }
};


// ==============================
// UPDATE TURF
// ==============================
export const updateTurf = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id);

    if (!turf) {
      return res.status(404).json({
        error: "Turf not found",
      });
    }

    // Ownership check
    if (
      req.user.role !== "superadmin" &&
      turf.owner.toString() !== req.user.id
    ) {
      return res.status(403).json({
        error: "Not authorized",
      });
    }

    const body = { ...req.body };

    if (body.interestToHost !== undefined) {
      body.interestToHost = body.interestToHost === 'true' || body.interestToHost === true;
    }

    // ==============================
    // PARSE & CLEANUP FIELDS
    // ==============================
    const fieldsToParse = [
      "location",
      "sports",
      "amenities",
      "rates",
      "operatingHours",
      "courts",
      "slotPricings",
      "sportConfigs",
    ];

    fieldsToParse.forEach((field) => {
      if (body[field] && typeof body[field] === "string") {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (error) {
          console.warn(`Failed to parse ${field}`, error.message);
        }
      }
    });

    // Cleanup empty fields
    Object.keys(body).forEach(key => {
      if (body[key] === "" || body[key] === null || body[key] === undefined) {
        delete body[key];
      }
      if (Array.isArray(body[key]) && body[key].length === 0) {
        if (["amenities", "slotPricings", "priceHikes"].includes(key)) {
          delete body[key];
        }
      }
    });

    // ==============================
    // HANDLE IMAGES
    // ==============================
    let currentImages = [];
    if (body.existingImages) {
      try {
        currentImages = JSON.parse(body.existingImages);
      } catch {
        currentImages = turf.images || [];
      }
    } else {
      currentImages = turf.images || [];
    }

    if (req.files) {
      const logoFile = req.files.find(f => f.fieldname === 'logo');
      if (logoFile) body.logo = logoFile.path || logoFile.secure_url;

      const imageFiles = req.files.filter(f => f.fieldname === 'images');
      if (imageFiles.length > 0) {
        const newImages = imageFiles.map(f => f.path || f.secure_url);
        body.images = [...currentImages, ...newImages];
      } else {
        body.images = currentImages;
      }
    } else {
      body.images = currentImages;
    }
    delete body.existingImages;

    // Ensure sportConfigs prices and sub-fields are handled
    if (Array.isArray(body.sportConfigs)) {
      body.sportConfigs = body.sportConfigs.map(config => {
        const sportImagesKey = `sportImages_${config.sportName}`;
        let sportImages = config.images || [];

        if (req.files && Array.isArray(req.files)) {
          const newSportImages = req.files
            .filter((file) => file.fieldname === sportImagesKey)
            .map((file) => file.path || file.secure_url);
          sportImages = [...sportImages, ...newSportImages];
        }

        return {
          ...config,
          pricePerHour: Number(config.pricePerHour || 0),
          images: sportImages,
          slotPricings: Array.isArray(config.slotPricings) 
            ? config.slotPricings.filter(sp => sp.price > 0).map(sp => ({ ...sp, price: Number(sp.price) }))
            : []
        };
      });
    }

    // ==============================
    // NUMBER CONVERSION & RATE SYNC
    // ==============================
    if (body.pricePerHour !== undefined) {
      body.pricePerHour = Number(body.pricePerHour);
    }
    if (body.peakHourSurcharge !== undefined) {
      body.peakHourSurcharge = Number(body.peakHourSurcharge);
    }

    // Always synchronize rates if any price component or rates themselves change
    // or if the turf is being updated, to ensure consistency.
    const basePrice = Number(body.pricePerHour !== undefined ? body.pricePerHour : turf.pricePerHour || 0);
    const surcharge = Number(body.peakHourSurcharge !== undefined ? body.peakHourSurcharge : turf.peakHourSurcharge || 0);
    
    // Get the base set of rates to work with
    let ratesToSync = [];
    if (Array.isArray(body.rates) && body.rates.length > 0) {
      ratesToSync = body.rates;
    } else if (Array.isArray(turf.rates) && turf.rates.length > 0) {
      ratesToSync = turf.rates.map(r => typeof r.toObject === 'function' ? r.toObject() : r);
    } else {
      ratesToSync = days.map(d => ({ day: d, isPeak: false }));
    }

    // Apply the synchronized prices
    body.rates = ratesToSync.map(r => ({
      ...r,
      day: r.day,
      isPeak: !!r.isPeak,
      price: r.isPeak ? (basePrice + surcharge) : basePrice
    }));

    if (body.slotDuration) {
      body.slotDuration = Number(
        body.slotDuration
      );
    }

    // Ensure slotPricings prices are numbers
    if (Array.isArray(body.slotPricings)) {
      body.slotPricings = body.slotPricings
        .filter(sp => sp.price > 0)
        .map(sp => ({ ...sp, price: Number(sp.price) }));
      if (body.slotPricings.length === 0) delete body.slotPricings;
    }

    // ==============================
    // UPDATE
    // ==============================
    const updatedTurf =
      await Turf.findByIdAndUpdate(
        req.params.id,
        body,
        {
          new: true,
          runValidators: true,
        }
      );

    res.json({
      success: true,
      message: "Turf updated successfully",
      turf: updatedTurf,
    });
  } catch (err) {
    console.error("Update Turf Error:", err);

    res.status(500).json({
      error:
        err.message ||
        "Server error while updating turf",
    });
  }
};


// ==============================
// REAL-TIME AVAILABILITY API
// ==============================
export const getTurfAvailability = async (
  req,
  res
) => {
  try {
    const { date, sport } = req.query;

    if (!date) {
      return res.status(400).json({
        error: "Date is required",
      });
    }

    const turf = await Turf.findById(
      req.params.id
    );

    if (!turf) {
      return res.status(404).json({
        error: "Turf not found",
      });
    }

    // Determine courts for this availability check
    let targetCourts = turf.courts;
    if (sport && Array.isArray(turf.sportConfigs)) {
      const sportConfig = turf.sportConfigs.find(
        (c) => c.sportName.toLowerCase() === sport.toLowerCase()
      );
      if (sportConfig && sportConfig.courts && sportConfig.courts.length > 0) {
        targetCourts = sportConfig.courts;
      }
    }

    // Get weekday name
    const dayName = new Date(date)
      .toLocaleDateString("en-US", {
        weekday: "long",
      });

    // Find operating day
    const operatingDay =
      turf.operatingHours.find(
        (d) => d.day === dayName
      );

    if (
      !operatingDay ||
      !operatingDay.isOpen
    ) {
      return res.json({
        success: true,
        slots: [],
      });
    }

    // ==============================
    // GENERATE TIME SLOTS
    // ==============================
    let slotDuration = turf.slotDuration || 60;
    if (sport && Array.isArray(turf.sportConfigs)) {
      const sportConfig = turf.sportConfigs.find(
        (c) => c.sportName.toLowerCase() === sport.toLowerCase()
      );
      if (sportConfig && sportConfig.slotDuration) {
        slotDuration = sportConfig.slotDuration;
      }
    }
    
    const slots = [];

    let current = parseTimeToMinutes(operatingDay.open);
    const closing = parseTimeToMinutes(operatingDay.close);

    while (current + slotDuration <= closing) {
      slots.push({
        startTime: formatMinutes(current),
        endTime: formatMinutes(current + slotDuration),
      });

      current += slotDuration;
    }

    // ==============================
    // GET BOOKINGS
    // ==============================
    const bookings =
      await Booking.find({
        turf: req.params.id,
        date,
        status: {
          $in: [
            "pending",
            "confirmed",
          ],
        },
      });

    // ==============================
    // REMOVE BOOKED SLOTS
    // ==============================
    const availableSlots =
      slots.map((slot) => {
        const bookedCourts =
          bookings.filter(
            (booking) =>
              booking.startTime ===
              slot.startTime
          );

        return {
          ...slot,

          totalCourts:
            targetCourts.length,

          bookedCourts:
            bookedCourts.length,

          availableCourts:
            targetCourts.length -
            bookedCourts.length,

          isAvailable:
            bookedCourts.length <
            targetCourts.length,
        };
      });

    res.json({
      success: true,
      slots: availableSlots,
    });
  } catch (err) {
    console.error(
      "Availability Error:",
      err
    );

    res.status(500).json({
      error: "Server Error",
    });
  }
};

export const deleteTurf = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id);

    if (!turf) {
      return res.status(404).json({
        error: "Turf not found",
      });
    }

    // Ownership check
    if (
      req.user.role !== "superadmin" &&
      turf.owner.toString() !== req.user.id
    ) {
      return res.status(403).json({
        error: "Not authorized",
      });
    }

    await turf.deleteOne();

    res.json({
      success: true,
      message: "Turf deleted successfully",
    });
  } catch (err) {
    console.error("Delete Turf Error:", err);

    res.status(500).json({
      error:
        err.message ||
        "Server Error while deleting turf",
    });
  }
};
// ==============================
// GET MY TURFS
// ==============================
// UPDATE TURF STATUS
// ==============================
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

    // Only superadmin can approve ANY turf. 
    // Admins can only update status if they own it (though usually superadmin does this)
    if (req.user.role !== 'superadmin' && turf.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this venue status" });
    }

    turf.status = status;
    turf.approvedBy = req.user.id;
    turf.approvedAt = status === 'approved' ? new Date() : null;
    await turf.save();

    res.json({
      success: true,
      message: `Turf ${status} successfully`,
      turf
    });
  } catch (err) {
    console.error("Update Turf Status Error:", err);
    res.status(500).json({ error: "Server Error while updating turf status" });
  }
};

// ==============================
export const getMyTurfs = async (req, res) => {
  try {
    let query = {
      owner: req.user.id,
    };

    // Superadmin can view all
    if (req.user.role === "superadmin") {
      query = {};
    }

    const turfs = await Turf.find(query)
      .sort("-createdAt")
      .populate("owner", "name email");

    res.json({
      success: true,
      count: turfs.length,
      turfs,
    });
  } catch (err) {
    console.error("Get My Turfs Error:", err);

    res.status(500).json({
      error: "Server Error while fetching turfs",
    });
  }
};


// ==============================
// GET ALL TURFS
// ==============================
export const getTurfs = async (req, res) => {
  try {
    const {
      city,
      location,
      sport,
      minPrice,
      maxPrice,
      rating,
      interestToHost,
    } = req.query;

    let query = {
      isActive: true,
      status: "approved",
    };

    if (interestToHost) {
      query.interestToHost = interestToHost === "true";
    }

    // Search location
    const searchLocation =
      city || location;

    if (searchLocation) {
      query.$or = [
        {
          "location.city":
            new RegExp(
              searchLocation,
              "i"
            ),
        },
        {
          "location.address":
            new RegExp(
              searchLocation,
              "i"
            ),
        },
        {
          "location.landmark":
            new RegExp(
              searchLocation,
              "i"
            ),
        },
      ];
    }

    // Sport filter
    if (sport) {
      query.sports = sport;
    }

    // Price filter
    if (minPrice || maxPrice) {
      query.pricePerHour = {};

      if (minPrice) {
        query.pricePerHour.$gte =
          Number(minPrice);
      }

      if (maxPrice) {
        query.pricePerHour.$lte =
          Number(maxPrice);
      }
    }

    // Rating filter
    if (rating) {
      query.rating = {
        $gte: Number(rating),
      };
    }

    const turfs = await Turf.find(query)
      .populate("owner", "name email");

    res.json({
      success: true,
      count: turfs.length,
      turfs,
    });
  } catch (err) {
    console.error("Get Turfs Error:", err);

    res.status(500).json({
      error: "Server Error while fetching turfs",
    });
  }
};


// ==============================
// SEARCH TURFS BY NAME (Simplified Search)
// ==============================
export const searchTurfsByName = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Search query (name) is required",
      });
    }

    const turfs = await Turf.find({
      name: new RegExp(name, "i"),
      isActive: true,
      status: "approved",
    }).select("name location images sports pricePerHour rating");

    res.json({
      success: true,
      count: turfs.length,
      turfs,
    });
  } catch (err) {
    console.error("Search Turfs Error:", err);
    res.status(500).json({
      success: false,
      message: "Server Error while searching turfs",
    });
  }
};

// ==============================
// GET SINGLE TURF
// ==============================
export const getTurfById = async (
  req,
  res
) => {
  try {
    const turf = await Turf.findById(
      req.params.id
    ).populate(
      "owner",
      "name email"
    );

    if (!turf) {
      return res.status(404).json({
        error: "Turf not found",
      });
    }

    // Find other turfs by the same owner (sibling venues)
    const siblingTurfs = await Turf.find({
      owner: turf.owner._id,
      _id: { $ne: turf._id }
    }).select("name sports images location status isActive");

    console.log(`Found ${siblingTurfs.length} siblings for owner ${turf.owner._id}`);

    res.json({
      success: true,
      turf,
      siblingTurfs
    });
  } catch (err) {
    console.error("Get Turf Error:", err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};


// ==============================
// GET TURF AVAILABILITY
// ==============================