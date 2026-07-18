import Support from "../models/support.model.js";

// @desc    Submit support ticket
// @route   POST /api/support
// @access  Public
export const createSupportTicket = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, error: "Please fill all fields" });
    }

    const ticket = await Support.create({
      name,
      email,
      subject,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Ticket submitted successfully",
      data: ticket,
    });
  } catch (err) {
    console.error("Create Support Ticket Error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Get all support tickets
// @route   GET /api/support
// @access  Private (Superadmin)
export const getSupportTickets = async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const tickets = await Support.find().sort("-createdAt");

    res.json({
      success: true,
      data: tickets,
    });
  } catch (err) {
    console.error("Get Support Tickets Error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Resolve a support ticket
// @route   PUT /api/support/:id/resolve
// @access  Private (Superadmin)
export const resolveSupportTicket = async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const ticket = await Support.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    ticket.status = "resolved";
    await ticket.save();

    res.json({
      success: true,
      message: "Ticket resolved successfully",
      data: ticket,
    });
  } catch (err) {
    console.error("Resolve Support Ticket Error:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
