
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from './src/models/auth/user.model.js';

dotenv.config();

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMTgwMTNiODYzNzUzODA0MTIyZDYzYSIsInJvbGUiOiJhZG1pbiIsInBlcm1pc3Npb25zIjpbInZpZXdfZGFzaGJvYXJkIiwidmlld19ib29raW5ncyIsIm1hbmFnZV9ib29raW5ncyIsInZpZXdfcmV2aWV3cyIsIm1hbmFnZV9yZXZpZXdzIiwidmlld192ZW51ZXMiLCJhZGRfdmVudWUiLCJlZGl0X3ZlbnVlIiwibWFuYWdlX3R1cmZzIiwibWFuYWdlX3RvdXJuYW1lbnRzIiwidmlld19jaGF0IiwibWFuYWdlX2NoYXQiXSwiaWF0IjoxNzgxODU2MTExLCJleHAiOjE3ODI0NjA5MTF9.ezabOMe8lqp3w6TqP2TTDC85K6ePeO_rlmvBpDIHn6w';

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const decoded = jwt.verify(TOKEN, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded);

    const user = await User.findById(decoded.id);
    console.log('User found:', JSON.stringify(user, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
