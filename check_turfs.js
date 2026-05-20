import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/turf-booking";

const checkTurfs = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");
    
    const turfs = await mongoose.connection.db.collection("turfs").find({}).toArray();
    console.log(`\nFound ${turfs.length} total venues/turfs:`);
    
    turfs.forEach(t => {
      console.log(`- Name: ${t.name}`);
      console.log(`  ID: ${t._id}`);
      console.log(`  Owner: ${t.owner}`);
      console.log(`  Status: ${t.status}`);
      console.log(`  Active: ${t.isActive}`);
      console.log(`  Sports: ${t.sports?.join(", ")}`);
      console.log('-------------------');
    });
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
};

checkTurfs();
