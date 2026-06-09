import Master from "../models/master.model.js";

export const updateMaster = async (req, res) => {
  try {
    const { name, category, playerCount } = req.body;

    let updateData = {
      name,
      category,
    };

    // Only allow playerCount for sport category
    if (category === "sport" && playerCount !== undefined) {
      updateData.playerCount = Number(playerCount);
    }

    if (req.file) {
      updateData.image = req.file.path || req.file.secure_url;
    }

    const master = await Master.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!master) {
      return res.status(404).json({
        success: false,
        msg: "Master entry not found",
      });
    }

    res.json({
      success: true,
      master,
    });

  } catch (err) {
    console.log("UPDATE MASTER ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: "This master entry already exists in this category",
      });
    }

    res.status(500).json({
      success: false,
      msg: err.message || "Internal server error",
    });
  }
};

export const createMaster = async (req, res) => {
  try {
    const { name, category, playerCount } = req.body;
    let imageData = "";
    
    if (req.file) {
      imageData = req.file.path || req.file.secure_url;
    }

    const masterData = {
      name,
      category,
      image: imageData,
    };

    // Only add playerCount if category is sport
    if (category === "sport" && playerCount !== undefined) {
      masterData.playerCount = Number(playerCount);
    }

    const master = await Master.create(masterData);
    
    res.status(201).json({ success: true, master });
  } catch (err) {
    console.log("CREATE MASTER ERROR:", err);
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        msg: "This master entry already exists in this category" 
      });
    }
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

export const deleteMaster = async (req, res) => {
  try {
    await Master.findByIdAndDelete(req.params.id);
    res.json({ success: true, msg: "Master deleted successfully" });
  } catch (err) {
    console.log("DELETE MASTER ERROR:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

export const getMasters = async (req, res) => {
  try {
    const masters = await Master.find({ isActive: true }).sort("name");
    res.json({ success: true, masters });
  } catch (err) {
    console.log("GET MASTERS ERROR:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
}; 