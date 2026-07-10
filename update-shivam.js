import mongoose from 'mongoose';
import Turf from './src/models/turf.model.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://ayushkotibox:TurfMongo1234@cluster0.x0shg9p.mongodb.net/mydb?retryWrites=true&w=majority')
  .then(async () => {
    console.log('Connected!');
    const res = await Turf.updateOne(
      { name: 'Shivam_Test_Venue' },
      {
        $set: {
          offer: {
            isActive: true,
            percentage: 20,
            badgeText: '20% OFF • on this ground',
            description: 'Offer on this ground - 20% OFF on evening slots',
            stripStyle: 'green',
            targetType: 'evening',
            startHour: '18:00',
            endHour: '22:00'
          }
        }
      }
    );
    console.log('Update result:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
