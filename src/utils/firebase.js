import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Notification from "../models/notification.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the service account JSON
const serviceAccountPath = path.join(__dirname, "../config/firebase-service-account.json");

let messagingInstance = null;

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    const app = initializeApp({
      credential: cert(serviceAccount),
    });
    messagingInstance = getMessaging(app);
    console.log("Firebase Admin SDK initialized successfully.");
  } else {
    console.warn("Firebase service account file not found at:", serviceAccountPath);
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
}

/**
 * Save notification to database
 * @param {string} userId - MongoDB user ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} type - Notification type
 * @param {object} [data] - Optional metadata
 */
export const saveNotification = async (userId, title, body, type, data = {}) => {
  try {
    await Notification.create({
      user: userId,
      title,
      body,
      type,
      data,
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving notification to DB:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to a single device AND save to DB
 * @param {string} userId - MongoDB user ID
 * @param {string} token - FCM Device registration token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} type - Notification type
 * @param {object} [data] - Optional metadata payload (must be string-string key-value pairs)
 */
export const sendPushAndSave = async (userId, token, title, body, type, data = {}) => {
  // 1. Save to DB first
  await saveNotification(userId, title, body, type, data);
  
  // 2. Send push notification (if token exists)
  if (token) {
    try {
      await sendPushNotification(token, title, body, data);
    } catch (err) {
      console.error("Push notification failed, but saved to DB:", err);
    }
  }
  
  return { success: true };
};

/**
 * Send push notification to a single device
 * @param {string} token - FCM Device registration token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} [data] - Optional metadata payload (must be string-string key-value pairs)
 */
export const sendPushNotification = async (token, title, body, data = {}) => {
  if (!messagingInstance) {
    console.warn("Firebase messaging not initialized. Cannot send push notification.");
    return { success: false, error: "Firebase not initialized" };
  }

  if (!token) {
    return { success: false, error: "Device token is required" };
  }

  // Ensure all values in data object are strings (required by FCM)
  const stringData = {};
  for (const [key, val] of Object.entries(data)) {
    stringData[key] = String(val);
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: stringData,
    token,
  };

  try {
    const response = await messagingInstance.send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending single FCM push notification:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple devices
 * @param {string[]} tokens - Array of FCM Device registration tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} [data] - Optional metadata payload (must be string-string key-value pairs)
 */
export const sendMulticastNotification = async (tokens, title, body, data = {}) => {
  if (!messagingInstance) {
    console.warn("Firebase messaging not initialized. Cannot send multicast push notifications.");
    return { success: false, error: "Firebase not initialized" };
  }

  const validTokens = tokens.filter(t => typeof t === "string" && t.trim() !== "");
  if (validTokens.length === 0) {
    return { success: true, msg: "No valid tokens provided" };
  }

  // Ensure all values in data object are strings
  const stringData = {};
  for (const [key, val] of Object.entries(data)) {
    stringData[key] = String(val);
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: stringData,
    tokens: validTokens,
  };

  try {
    const response = await messagingInstance.sendEachForMulticast(message);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    };
  } catch (error) {
    console.error("Error sending multicast FCM push notifications:", error);
    return { success: false, error: error.message };
  }
};
