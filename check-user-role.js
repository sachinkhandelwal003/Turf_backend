
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/auth/user.model.js';

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findById('6a18013b863753804122d63a');
    console.log('User keys:', Object.keys(user.toObject()));
    console.log('User role value:', user.role);
    console.log('Full user:', user.toObject());

    // Let's update the user to have role: "admin"
    await User.updateOne(
      { _id: '6a18013b863753804122d63a' },
      { $set: { role: 'admin' } }
    );
    console.log('User updated with role: admin');
    const updatedUser = await User.findById('6a18013b863753804122d63a');
    console.log('Updated user:', updatedUser.toObject());

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
