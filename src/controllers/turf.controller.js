import Turf from "../models/turf.model.js";
import Booking from "../models/booking.model.js";


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
          (file) => `/uploads/${file.filename}`
        );
      }

      if (req.files.logo) {
        body.logo = `/uploads/${req.files.logo[0].filename}`;
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
      "priceHikes",
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
              `/uploads/${file.filename}`
          );

        body.images = [
          ...currentImages,
          ...newImages,
        ];
      } else {
        body.images = currentImages;
      }

      if (req.files.logo) {
        body.logo = `/uploads/${req.files.logo[0].filename}`;
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
      "priceHikes",
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
    const slotDuration =
      turf.slotDuration || 60;

    const slots = [];

    let current =
      parseInt(
        operatingDay.open.split(":")[0]
      ) *
        60 +
      parseInt(
        operatingDay.open.split(":")[1]
      );

    const closing =
      parseInt(
        operatingDay.close.split(":")[0]
      ) *
        60 +
      parseInt(
        operatingDay.close.split(":")[1]
      );

    while (current + slotDuration <= closing) {
      const startHour = String(
        Math.floor(current / 60)
      ).padStart(2, "0");

      const startMin = String(
        current % 60
      ).padStart(2, "0");

      const endMinutes =
        current + slotDuration;

      const endHour = String(
        Math.floor(endMinutes / 60)
      ).padStart(2, "0");

      const endMin = String(
        endMinutes % 60
      ).padStart(2, "0");

      slots.push({
        startTime: `${startHour}:${startMin}`,
        endTime: `${endHour}:${endMin}`,
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

    res.json({
      success: true,
      turf,
    });
  } catch (err) {
    console.error("Get Turf Error:", err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};


// ==============================
// UPDATE TURF STATUS
// ==============================
export const updateTurfStatus =
  async (req, res) => {
    try {
      const { status } = req.body;

      if (
        ![
          "approved",
          "rejected",
          "pending",
        ].includes(status)
      ) {
        return res.status(400).json({
          error: "Invalid status",
        });
      }

      const turf =
        await Turf.findById(
          req.params.id
        );

      if (!turf) {
        return res.status(404).json({
          error: "Turf not found",
        });
      }

      turf.status = status;

      if (status === "approved") {
        turf.approvedBy =
          req.user.id;

        turf.approvedAt =
          new Date();
      }

      await turf.save();

      res.json({
        success: true,
        message: `Turf ${status} successfully`,
        turf,
      });
    } catch (err) {
      console.error(
        "Update Turf Status Error:",
        err
      );

      res.status(500).json({
        error: "Server Error",
      });
    }
  };