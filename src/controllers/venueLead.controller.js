import VenueLead from "../models/venueLead.model.js";

export const createVenueLead = async (req, res) => {
  try {
    const { groundName, turfName, location, ownerName, contactNumber, email } = req.body;

    if (!groundName || !turfName || !location || !ownerName || !contactNumber || !email) {
      return res.status(400).json({ success: false, msg: "All fields are required" });
    }

    // Server-side Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, msg: "Invalid email address format" });
    }

    // Server-side Phone Validation (10 digits Indian)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(contactNumber)) {
      return res.status(400).json({ success: false, msg: "Invalid 10-digit Indian phone number" });
    }

    let photos = [];
    if (req.files && req.files.photos) {
      photos = req.files.photos.map((file) => file.path || file.secure_url);
    }

    const lead = await VenueLead.create({
      groundName,
      turfName,
      location,
      ownerName,
      contactNumber,
      email,
      photos,
    });

    res.status(201).json({
      success: true,
      msg: "Lead submitted successfully! Our team will contact you soon.",
      lead,
    });
  } catch (err) {
    console.error("Submit Lead Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error. Please try again later." });
  }
};

// GET ALL LEADS (Admin/Superadmin only)
export const getVenueLeads = async (req, res) => {
  try {
    const leads = await VenueLead.find().sort({ createdAt: -1 });
    res.json({ success: true, leads });
  } catch (err) {
    console.error("Get Leads Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// UPDATE LEAD STATUS
export const updateVenueLeadStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const { id } = req.params;

    const lead = await VenueLead.findByIdAndUpdate(
      id,
      { status, notes },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ success: false, msg: "Lead not found" });
    }

    res.json({ success: true, msg: "Lead status updated", lead });
  } catch (err) {
    console.error("Update Lead Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

// DELETE LEAD
export const deleteVenueLead = async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await VenueLead.findByIdAndDelete(id);

    if (!lead) {
      return res.status(404).json({ success: false, msg: "Lead not found" });
    }

    res.json({ success: true, msg: "Lead deleted successfully" });
  } catch (err) {
    console.error("Delete Lead Error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};
