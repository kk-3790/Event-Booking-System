const Notification = require('../models/Notification');

// GET /api/notifications/my  (logged-in user's own notifications)
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate('booking')
      .sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
};

module.exports = { getMyNotifications };