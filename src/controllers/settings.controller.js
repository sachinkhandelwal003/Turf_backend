import Settings from "../models/settings.model.js";

export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Handle JSON strings from FormData
    if (typeof updateData.googleLogin === 'string') {
      updateData.googleLogin = JSON.parse(updateData.googleLogin);
    }
    if (typeof updateData.appleLogin === 'string') {
      updateData.appleLogin = JSON.parse(updateData.appleLogin);
    }
    if (typeof updateData.heroBanner === 'string') {
      updateData.heroBanner = JSON.parse(updateData.heroBanner);
    }
    if (typeof updateData.razorpay === 'string') {
      updateData.razorpay = JSON.parse(updateData.razorpay);
    }

    // Handle File Uploads
    if (req.files) {
      if (req.files.frontendLogo) {
        updateData.frontendLogo = req.files.frontendLogo[0].path || req.files.frontendLogo[0].secure_url;
      } else if (req.body.frontendLogo === "") {
        updateData.frontendLogo = "";
      }

      if (req.files.backendLogo) {
        updateData.backendLogo = req.files.backendLogo[0].path || req.files.backendLogo[0].secure_url;
      } else if (req.body.backendLogo === "") {
        updateData.backendLogo = "";
      }

      if (req.files.image) {
        if (!updateData.heroBanner) updateData.heroBanner = {};
        updateData.heroBanner.image = req.files.image[0].path || req.files.image[0].secure_url;
      } else if (req.body.heroBannerImage === "") {
        if (!updateData.heroBanner) updateData.heroBanner = {};
        updateData.heroBanner.image = "";
      }
    } else {
      // If no files uploaded, check for explicit removals
      if (req.body.frontendLogo === "") updateData.frontendLogo = "";
      if (req.body.backendLogo === "") updateData.backendLogo = "";
      if (req.body.heroBannerImage === "") {
        if (!updateData.heroBanner) updateData.heroBanner = {};
        updateData.heroBanner.image = "";
      }
    }

    let settings = await Settings.findOne();
    if (settings) {
      settings = await Settings.findOneAndUpdate({}, updateData, { new: true });
    } else {
      settings = await Settings.create(updateData);
    }

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
};
