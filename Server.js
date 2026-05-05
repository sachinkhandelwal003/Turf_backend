// 1. THIS MUST BE LINE 1 - It forces dotenv to load before anything else
import 'dotenv/config'; 

// 2. Now we can safely import everything else
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";

// Let's add a quick check to prove it works
console.log("Checking MONGO_URI:", process.env.MONGO_URI ? "Found it!" : "Still undefined 😭");

// 3. Connect to DB
connectDB();

// 4. Start Server
const port = process.env.PORT || 5001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});