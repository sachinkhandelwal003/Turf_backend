import Settlement from "../models/settlement.model.js";
import User from "../models/auth/user.model.js";

export const createSettlement = async (req, res) => {
  try {
    const { adminId, amount, type, notes, paymentMethod, transactionId } = req.body;

    if (!adminId || !amount || !type) {
      return res.status(400).json({ success: false, msg: "Missing required fields" });
    }

    const settlement = await Settlement.create({
      admin: adminId,
      amount,
      type,
      notes,
      paymentMethod,
      transactionId,
      status: "completed", // By default manual settlements are marked completed
      settledAt: new Date()
    });

    res.status(201).json({ success: true, settlement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getSettlements = async (req, res) => {
  try {
    const { adminId } = req.query;
    let query = {};
    if (adminId) query.admin = adminId;

    const settlements = await Settlement.find(query)
      .populate("admin", "name email")
      .sort("-createdAt");

    res.json({ success: true, settlements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateSettlementStatus = async (req, res) => {
  try {
    const { status, transactionId, notes } = req.body;
    const settlement = await Settlement.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        transactionId, 
        notes,
        ...(status === 'completed' ? { settledAt: new Date() } : {})
      },
      { new: true }
    );

    res.json({ success: true, settlement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
