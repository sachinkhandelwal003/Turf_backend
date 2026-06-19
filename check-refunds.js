
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Refund from './src/models/refund.model.js';

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB!');

    const refunds = await Refund.find().limit(10);
    console.log('Found', refunds.length, 'refunds!');
    refunds.forEach((r, i) => {
      console.log(`Refund ${i + 1}:`, {
        _id: r._id,
        admin: r.admin,
        user: r.user,
        booking: r.booking,
        status: r.status,
      });
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
