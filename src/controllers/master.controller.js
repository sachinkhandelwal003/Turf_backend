import Master from "../models/master.model.js";

export const getMasters = async (req, res) => {
  try {
    const masters = await Master.find({ isActive: true }).sort("name");
    res.json({ success: true, masters });
  } catch (err) {
    console.log(err);

res.status(500).json({
  error: err.message,
});
  }
};

export const createMaster = async (req, res) => {
  try {
    const { name, category } = req.body;
    let imageData = "";
    
    if (req.file) {
      imageData = req.file.path || req.file.secure_url;
    }

  const master = await Master.create({
  name,
  category,
  image: imageData,
});
    
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

export const updateMaster = async (req, res) => {
  try {
    const { name, category } = req.body;

    let updateData = {
      name,
      category,
    };

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
        error: "Master entry not found",
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
        error: "This master entry already exists in this category",
      });
    }

    res.status(500).json({
      error: err.message,
    });
  }
}; 