import mongoose from "mongoose";

const turfSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      address: {
        type: String,
        required: true,
      },

      city: {
        type: String,
        required: true,
      },

      landmark: {
        type: String,
      },

      mapUrl: {
        type: String,
      },

      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    // Base pricing
    pricePerHour: {
      type: Number,
      required: true,
    },

    peakHourSurcharge: {
      type: Number,
      default: 0,
    },

    // Slot duration in minutes
    slotDuration: {
      type: Number,
      default: 60,
    },

    surfaceType: {
      type: String,
    },

    // Dynamic pricing by specific time slots
    slotPricings: [
      {
        startTime: String, // e.g. "06:00"
        endTime: String,   // e.g. "07:00"
        price: Number,
        isPeak: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Dynamic pricing by day
    rates: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },

        price: {
          type: Number,
          default: 0,
        },

        isPeak: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Working hours only
    operatingHours: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },

        open: {
          type: String,
          default: "06:00",
        },

        close: {
          type: String,
          default: "22:00",
        },

        isOpen: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // Courts
    courts: [
      {
        name: {
          type: String,
          required: true,
        },

        courtType: {
          type: String,
          required: true,
        },

        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // Sport specific configurations
    sportConfigs: [
      {
        sportName: {
          type: String,
          required: true,
        },

        pricePerHour: {
          type: Number,
          required: true,
        },

        slotDuration: {
          type: Number,
          default: 60, // Default 60 mins
        },

        maxPlayers: {
          type: Number,
          default: 10, // Default number of players
        },

        slotPricings: [
          {
            startTime: String, // e.g. "06:00"
            endTime: String,   // e.g. "07:00"
            price: Number,
            isPeak: {
              type: Boolean,
              default: false,
            },
          },
        ],

        courts: [
          {
            name: {
              type: String,
              required: true,
            },
            isActive: {
              type: Boolean,
              default: true,
            },
          },
        ],

        images: {
          type: [String],
          default: [],
        },
      },
    ],

    // Sports
    sports: {
      type: [String],
      default: [],
    },

    // Amenities
    amenities: {
      type: [String],
      default: [],
    },

    logo: {
      type: String,
      default: "",
    },

    images: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      default: "",
    },

    upiId: {
      type: String,
      trim: true,
    },

    rating: {
      type: Number,
      default: 0,
    },

    reviewsCount: {
      type: Number,
      default: 0,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    interestToHost: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Turf", turfSchema);