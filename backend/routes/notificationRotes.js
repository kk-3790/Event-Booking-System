const express = require('express');
const router = express.Router();
const { getMyNotifications } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/my', protect, getMyNotifications);

module.exports = router;