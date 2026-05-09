import express from "express";

import {
  createConversation,
  sendMessage,
  getMessages,
  getUserConversations,
  getSuperAdmin,
  getAllAdmins,
  deleteMessage,
  reactToMessage,
} from "../controllers/chat.controller.js";
import { upload } from "../middleware/multer.middleware.js";

import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission, checkAnyPermission } from "../middleware/rbac.middleware.js";

const router = express.Router();


// GET ALL ADMINS
router.get(
  "/admins",
  authMiddleware,
  checkPermission("manage_chat"),
  getAllAdmins
);


// GET SUPERADMIN
router.get(
  "/superadmin",
  authMiddleware,
  getSuperAdmin
);


// CREATE CONVERSATION
router.post(
  "/conversation",
  authMiddleware,
  createConversation
);


// SEND MESSAGE
router.post(
  "/message",
  authMiddleware,
  upload.single("file"),
  sendMessage
);


// DELETE MESSAGE (UNSEND)
router.delete(
  "/message/:messageId",
  authMiddleware,
  deleteMessage
);


// REACT TO MESSAGE
router.post(
  "/message/:messageId/react",
  authMiddleware,
  reactToMessage
);


// GET ALL MESSAGES
router.get(
  "/messages/:conversationId",
  authMiddleware,
  getMessages
);

// GET USER CONVERSATIONS
router.get(
  "/conversations/:userId",
  authMiddleware,
  getUserConversations
);

export default router;