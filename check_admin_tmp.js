import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const checkAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const user = await mongoose.connection.db.collection("users").findOne({ email: "admin@turf.com" });
    console.log("Admin User Details:", JSON.stringify(user, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkAdmin();
