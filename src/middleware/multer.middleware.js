import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import path from "path";

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "turf_bookings",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "jfif", "svg", "pdf"],
    transformation: [{ width: 1000, height: 1000, crop: "limit" }],
  },
});

const fileFilter = (req, file, cb) => {
  // If it's an image, let it through
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    // For other files, check extensions
    const allowedExtensions = [
      ".jpeg", ".jpg", ".png", ".webp", ".gif", ".jfif", ".svg",
      ".pdf", ".doc", ".docx", ".xls", ".xlsx" // Added doc support just in case
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported"), false);
    }
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});
