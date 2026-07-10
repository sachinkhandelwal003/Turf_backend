import mongoose from 'mongoose';
import Turf from './src/models/turf.model.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://ayushkotibox:TurfMongo1234@cluster0.x0shg9p.mongodb.net/mydb?retryWrites=true&w=majority')
  .then(async () => {
    const turfs = await Turf.find({ name: 'Shivam_Test_Venue' });
    const mappedTurfs = turfs.map((t) => {
      const turfObj = t.toObject();
      if (turfObj.offer && turfObj.offer.isActive) {
        turfObj.offer_summary = {
          badge_text: turfObj.offer.badgeText,
          percent: turfObj.offer.percentage,
          strip_style: turfObj.offer.stripStyle,
        };
      } else {
        turfObj.offer_summary = null;
      }
      return turfObj;
    });
    console.log(JSON.stringify(mappedTurfs.map(t => ({ name: t.name, offer_summary: t.offer_summary, offer: t.offer })), null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
