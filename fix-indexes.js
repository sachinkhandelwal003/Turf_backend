import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dropDuplicateIndexes = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/mydb';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB...');

    const collection = mongoose.connection.db.collection('bookings');
    
    // List of indexes to drop that are causing issues with multi-slot/multi-court bookings
    const indexesToDrop = [
      'turf_1_date_1_startTime_1',
      'turf_1_date_1_startTime_1_courts_1'
    ];

    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`Dropped index: ${indexName}`);
      } catch (err) {
        if (err.codeName === 'IndexNotFound') {
          console.log(`Index ${indexName} not found, skipping...`);
        } else {
          console.error(`Error dropping ${indexName}:`, err.message);
        }
      }
    }

    console.log('Index cleanup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

dropDuplicateIndexes();
