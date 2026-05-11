import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/auth/user.model.js";


// CREATE CONVERSATION
export const createConversation = async (req, res) => {
  try {
    const {
      type,
      participants,
      createdBy,
      assignedTo,
      bookingId,
    } = req.body;

    // Check if conversation already exists between these participants for this type
    const existing = await Conversation.findOne({
      type,
      participants: { $all: participants }
    });

    if (existing && existing.participants.length === participants.length) {
      const populatedExisting = await Conversation.findById(existing._id)
        .populate("participants", "name role profilePhoto");

      return res.status(200).json({
        success: true,
        conversation: populatedExisting,
      });
    }

    const conversation = await Conversation.create({
      type,
      participants,
      createdBy,
      assignedTo,
      bookingId,
    });

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("participants", "name role profilePhoto");

    res.status(201).json({
      success: true,
      conversation: populatedConversation,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET SUPERADMIN
export const getSuperAdmin = async (req, res) => {
  try {
    const superadmin = await User.findOne({ role: "superadmin" }).select("name role profilePhoto");
    if (!superadmin) {
      return res.status(404).json({
        success: false,
        message: "Superadmin not found",
      });
    }
    res.status(200).json({
      success: true,
      superadmin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET ALL ADMINS
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" }).select("name role profilePhoto");
    res.status(200).json({
      success: true,
      admins,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




// SEND MESSAGE
export const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      senderId,
      senderRole,
      text,
      replyTo,
    } = req.body;

    let fileData;
    if (req.file) {
      const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 
                       req.file.mimetype.startsWith('video/') ? 'video' :
                       req.file.mimetype.startsWith('audio/') ? 'audio' : 'document';
      
      fileData = {
        url: `/uploads/${req.file.filename}`,
        name: req.file.originalname,
        type: fileType,
        size: req.file.size
      };
    }

    const message = await Message.create({
      conversationId,
      senderId,
      senderRole,
      text,
      file: fileData,
      replyTo,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "name role profilePhoto")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "name" }
      });

    await Conversation.findByIdAndUpdate(
      conversationId,
      {
        lastMessage: text || (fileData ? `Sent a ${fileData.type}` : "New message"),
        updatedAt: Date.now()
      }
    );

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE MESSAGE (UNSEND)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByIdAndUpdate(
      messageId,
      { isDeleted: true, text: "This message was deleted", file: undefined },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// REACT TO MESSAGE
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    const existingReactionIndex = message.reactions.findIndex(r => r.userId.toString() === userId);
    
    if (existingReactionIndex > -1) {
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        // Remove reaction if same emoji
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Update emoji
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      // Add new reaction
      message.reactions.push({ userId, emoji });
    }

    await message.save();
    
    const populatedMessage = await Message.findById(messageId)
      .populate("senderId", "name role profilePhoto")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "name" }
      });

    res.status(200).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




// GET ALL MESSAGES
export const getMessages = async (req, res) => {
  try {

    const { conversationId } = req.params;
const messages = await Message.find({
  conversationId,
})
  .sort({ createdAt: 1 })
  .populate(
    "senderId",
    "name role profilePhoto"
  );

    res.status(200).json({
      success: true,
      messages,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};




// GET USER CONVERSATIONS
export const getUserConversations = async (req, res) => {
  try {

    const { userId } = req.params;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ updatedAt: -1 })
      .populate("participants", "name role");

    res.status(200).json({
      success: true,
      conversations,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};