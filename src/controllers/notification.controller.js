import Notification from '../models/notification.model.js';

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        hasMore: notifications.length === limit
      }
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error("Mark As Read Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("Mark All As Read Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    console.error("Delete Notification Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
