import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import models
import Booking from './src/models/booking.model.js';
import Match from './src/models/match.model.js';
import Tournament from './src/models/tournament.model.js';
import Settlement from './src/models/settlement.model.js';

dotenv.config();

const resetStats = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    console.log('\n⚠️ DELETING ALL REVENUE AND BOOKING DATA ⚠️\n');

    const resultBookings = await Booking.deleteMany({});
    console.log(`✅ Deleted ${resultBookings.deletedCount} Bookings`);

    const resultMatches = await Match.deleteMany({});
    console.log(`✅ Deleted ${resultMatches.deletedCount} Matches`);

    const resultTournaments = await Tournament.deleteMany({});
    console.log(`✅ Deleted ${resultTournaments.deletedCount} Tournaments`);

    const resultSettlements = await Settlement.deleteMany({});
    console.log(`✅ Deleted ${resultSettlements.deletedCount} Settlements`);

    console.log('\n🎉 ALL DASHBOARD STATS HAVE BEEN RESET TO ZERO! 🎉');
    console.log('Note: Venues (Turfs), Users, and Master data were NOT deleted.');
    
    process.exit();
  } catch (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  }
};

resetStats();
