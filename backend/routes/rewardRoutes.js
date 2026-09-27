const express = require('express');
const router = express.Router();
const {
  getEventDraw,
  createOrUpdateDraw,
  executeDraw,
  applyPromoCode,
} = require('../controllers/rewardController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Public or optional-auth to view draw details for an event
router.get('/event/:eventId', getEventDraw);

// Customer promo verification
router.post('/apply-promo', protect, authorizeRoles('CUSTOMER'), applyPromoCode);

// Organizer / Admin routes
router.post('/event/:eventId', protect, authorizeRoles('ORGANIZER', 'ADMIN'), createOrUpdateDraw);
router.post('/draw/:id', protect, authorizeRoles('ORGANIZER', 'ADMIN'), executeDraw);

module.exports = router;
