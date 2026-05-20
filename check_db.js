import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const checkRegistrations = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");
    
    const tournaments = await mongoose.connection.db.collection("tournaments").find({}).toArray();
    console.log(`Found ${tournaments.length} tournaments`);
    
    tournaments.forEach(t => {
      if (t.registeredTeams && t.registeredTeams.length > 0) {
        console.log(`Tournament: ${t.title} (${t._id})`);
        t.registeredTeams.forEach(reg => {
          console.log(`  - Team: ${reg.name}, Captain: ${reg.captain}, User: ${reg.user}, Email: ${reg.email}, Phone: ${reg.contact}`);
        });
      }
    });
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
};

checkRegistrations();
