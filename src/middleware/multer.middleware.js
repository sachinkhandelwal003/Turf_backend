import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists using an absolute path to avoid permission issues
const uploadDir = path.resolve(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

console.log("Multer upload directory set to:", uploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

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

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(ext)
  ) {
    cb(null, true);
  } else {
    console.log("Rejected File:", file);

    cb(
      new Error(
        "Only jpeg, jpg, png, webp, and gif images are allowed"
      ),
      false
    );
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});
