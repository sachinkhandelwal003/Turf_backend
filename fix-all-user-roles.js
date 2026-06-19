
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/auth/user.model.js';

dotenv.config();

async function fix() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Update all users that don't have a role to have role: "user"
    const result = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'user' } }
    );
    console.log('Updated users:', result.modifiedCount);

    // Check all users now
    const users = await User.find({});
    console.log('All users:');
    users.forEach(u => {
      console.log(`  ${u.name} (${u.email}): role=${u.role}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fix();
