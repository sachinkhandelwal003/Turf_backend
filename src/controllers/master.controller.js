import Master from "../models/master.model.js";

export const getMasters = async (req, res) => {
  try {
    const masters = await Master.find({ isActive: true }).sort("name");
    res.json({ success: true, masters });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

export const createMaster = async (req, res) => {
  try {
    const { name, category } = req.body;
    const master = await Master.create({ name, category });
    res.status(201).json({ success: true, master });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "This master entry already exists in this category" });
    }
    res.status(500).json({ error: "Server Error" });
  }
};

export const deleteMaster = async (req, res) => {
  try {
    await Master.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Master deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
