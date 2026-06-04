import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/turf-booking";

const inspect = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));

    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`Collection: ${col.name} has ${count} documents`);
    }
    
    const turfs = await mongoose.connection.db.collection("turves").find({}).toArray();
    console.log(`\n--- TURFS (${turfs.length}) ---`);
    turfs.forEach(t => {
      console.log(`Name: ${t.name} (${t._id})`);
      console.log(`Sports: ${t.sports?.join(", ")}`);
      console.log(`Base Courts:`, JSON.stringify(t.courts));
      console.log(`Sport Configs:`);
      t.sportConfigs?.forEach(sc => {
        console.log(`  - Sport: ${sc.sportName}`);
        console.log(`    Courts:`, JSON.stringify(sc.courts));
      });
      console.log('-------------------');
    });

    const bookings = await mongoose.connection.db.collection("bookings").find({ status: { $ne: "cancelled" } }).toArray();
    console.log(`\n--- ACTIVE BOOKINGS (${bookings.length}) ---`);
    bookings.forEach(b => {
      console.log(`Turf: ${b.turf}`);
      console.log(`Sport: ${b.sport}`);
      console.log(`Date: ${b.date}`);
      console.log(`Time: ${b.startTime} - ${b.endTime}`);
      console.log(`Slots:`, JSON.stringify(b.slots));
      console.log(`Courts:`, JSON.stringify(b.courts));
      console.log('-------------------');
    });
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
};

inspect();
