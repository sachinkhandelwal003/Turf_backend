import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import path from "path";

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "turf_bookings", // Change to your project folder name
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: [{ width: 1000, height: 1000, crop: "limit" }],
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [
    ".jpeg",
    ".jpg",
    ".png",
    ".webp",
    ".gif",
    ".JPEG",
    ".JPG",
    ".PNG",
    ".WEBP",
    ".GIF",
    ".jfif"
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only jpeg, jpg, png, webp, and gif images are allowed"),
      false
    );
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});
