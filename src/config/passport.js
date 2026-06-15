import passport from 'passport';
import AppleStrategy from 'passport-apple';
import User from '../models/auth/user.model.js';

passport.use(new AppleStrategy({
  clientID: process.env.APPLE_CLIENT_ID,
  teamID: process.env.APPLE_TEAM_ID,
  keyID: process.env.APPLE_KEY_ID,
  privateKey: process.env.APPLE_PRIVATE_KEY,
  callbackURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/apple/callback`,
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, idToken, profile, done) => {
  try {
    const appleId = profile.id;
    const email = profile._json?.email;
    const fullName = profile._json?.name;

    // Check if user exists
    let user = await User.findOne({
      $or: [
        { appleId },
        ...(email ? [{ email: email.toLowerCase() }] : [])
      ],
    });

    if (user) {
      // Update user if needed
      if (!user.appleId) {
        user.appleId = appleId;
      }
      if (email && !user.email) {
        user.email = email.toLowerCase();
      }
      await user.save();
    } else {
      // Create new user
      let userName = "Apple User";
      if (fullName) {
        const nameParts = [];
        if (fullName.firstName) nameParts.push(fullName.firstName);
        if (fullName.lastName) nameParts.push(fullName.lastName);
        if (nameParts.length > 0) {
          userName = nameParts.join(' ');
        }
      } else if (email) {
        userName = email.split('@')[0];
      }

      user = await User.create({
        name: userName,
        email: email ? email.toLowerCase() : `apple_${appleId}@example.com`,
        appleId,
        profilePhoto: "",
        isVerified: true,
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

export default passport;
