
import multer from "multer";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Multer upload with memory storage and 10MB limit (before compression)
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file before compression
  fileFilter: fileFilter,
});

// Function to upload buffer to Cloudinary
const uploadBufferToCloudinary = async (buffer, folder = "turf_bookings") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        transformation: [
          { width: 800, height: 800, crop: "limit", quality: "auto:good" }
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );

    // Convert buffer to readable stream and pipe to Cloudinary
    const readableStream = Readable.from(buffer);
    readableStream.pipe(uploadStream);
  });
};

// Middleware to process images with Sharp and upload to Cloudinary
const processAndUploadImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  try {
    // Process each file
    const uploadedFiles = [];

    for (const file of req.files) {
      // Compress image with Sharp
      const compressedBuffer = await sharp(file.buffer)
        .rotate() // Auto-rotate based on EXIF data
        .resize({
          width: 800,
          height: 800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality (or use webp for smaller size)
        .toBuffer();

      // Upload compressed image to Cloudinary
      const secureUrl = await uploadBufferToCloudinary(compressedBuffer);
      
      uploadedFiles.push({
        fieldname: file.fieldname,
        originalname: file.originalname,
        path: secureUrl,
        secure_url: secureUrl,
      });
    }

    // Replace req.files with processed files
    req.files = uploadedFiles;
    next();
  } catch (error) {
    console.error("Image Processing Error:", error);
    res.status(500).json({ error: "Failed to process images" });
  }
};

export { upload, processAndUploadImages };

