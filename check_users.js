import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const checkUsers = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const users = await mongoose.connection.db.collection("users").find({}).toArray();
    users.forEach(u => {
      console.log(`User: ${u.name}, Email: ${u.email}, Phone: ${u.phone}, ID: ${u._id}`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkUsers();
