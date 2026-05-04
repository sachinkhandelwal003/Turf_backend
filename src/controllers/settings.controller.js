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

    // Handle File Uploads
    if (req.files) {
      if (req.files.frontendLogo) {
        updateData.frontendLogo = `/uploads/${req.files.frontendLogo[0].filename}`;
      }
      if (req.files.backendLogo) {
        updateData.backendLogo = `/uploads/${req.files.backendLogo[0].filename}`;
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
