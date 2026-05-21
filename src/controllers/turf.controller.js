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

// ==============================
// CREATE TURF
// ==============================
export const createTurf = async (req, res) => {
  try {
    const body = { ...req.body };

    // Validation
    if (
      !body.name ||
      body.pricePerHour === undefined ||
      body.pricePerHour === ""
    ) {
      return res.status(400).json({
        error: "Name and price per hour are required",
      });
    }

    // ==============================
    // HANDLE IMAGES
    // ==============================
    if (req.files) {
      if (req.files.images) {
        body.images = req.files.images.map(
          (file) => file.path || file.secure_url
        );
      }

      if (req.files.logo) {
        body.logo = req.files.logo[0].path || req.files.logo[0].secure_url;
      }
    }

    if (!body.images) body.images = [];
    if (!body.logo) body.logo = "";

    // ==============================
    // PARSE JSON FIELDS
    // ==============================
    const fieldsToParse = [
      "location",
      "sports",
      "amenities",
      "rates",
      "operatingHours",
      "courts",
      "slotPricings",
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

    // Ensure slotPricings prices are numbers after parsing
    if (Array.isArray(body.slotPricings)) {
      body.slotPricings = body.slotPricings.map(sp => ({
        ...sp,
        price: Number(sp.price || 0)
      }));
    }

    // ==============================
    // CONVERT NUMBERS
    // ==============================
    body.pricePerHour = Number(body.pricePerHour);

    if (body.peakHourSurcharge) {
      body.peakHourSurcharge = Number(
        body.peakHourSurcharge
      );
    }

    if (body.slotDuration) {
      body.slotDuration = Number(
        body.slotDuration
      );
    }

    // Ensure slotPricings prices are numbers after parsing
    if (Array.isArray(body.slotPricings)) {
      body.slotPricings = body.slotPricings.map(sp => ({
        ...sp,
        price: Number(sp.price || 0)
      }));
    }

    // ==============================
    // CREATE TURF
    // ==============================
    const turf = await Turf.create({
      ...body,

      owner: req.user.id,

      status:
        req.user.role === "superadmin"
          ? "approved"
          : "pending",

      approvedBy:
        req.user.role === "superadmin"
          ? req.user.id
          : null,

      approvedAt:
        req.user.role === "superadmin"
          ? new Date()
          : null,
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

    // ==============================
    // HANDLE EXISTING IMAGES
    // ==============================
    let currentImages = [];

    if (body.existingImages) {
      try {
        currentImages = JSON.parse(
          body.existingImages
        );
      } catch {
        currentImages = turf.images || [];
      }
    } else {
      currentImages = turf.images || [];
    }

    // ==============================
    // HANDLE NEW IMAGES
    // ==============================
    if (req.files) {
      if (req.files.images) {
        const newImages =
          req.files.images.map(
            (file) =>
              file.path || file.secure_url
          );

        body.images = [
          ...currentImages,
          ...newImages,
        ];
      } else {
        body.images = currentImages;
      }

      if (req.files.logo) {
        body.logo = req.files.logo[0].path || req.files.logo[0].secure_url;
      }
    } else {
      body.images = currentImages;
    }

    delete body.existingImages;

    // ==============================
    // PARSE JSON FIELDS
    // ==============================
    const fieldsToParse = [
      "location",
      "sports",
      "amenities",
      "rates",
      "operatingHours",
      "courts",
      "slotPricings",
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
    // NUMBER CONVERSION
    // ==============================
    if (body.pricePerHour) {
      body.pricePerHour = Number(
        body.pricePerHour
      );
    }

    if (body.peakHourSurcharge) {
      body.peakHourSurcharge = Number(
        body.peakHourSurcharge
      );
    }

    if (body.slotDuration) {
      body.slotDuration = Number(
        body.slotDuration
      );
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
    const { date } = req.query;

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
    const slotDuration = turf.slotDuration || 60;
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
            turf.courts.length,

          bookedCourts:
            bookedCourts.length,

          availableCourts:
            turf.courts.length -
            bookedCourts.length,

          isAvailable:
            bookedCourts.length <
            turf.courts.length,
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
    } = req.query;

    let query = {
      isActive: true,
      status: "approved",
    };

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