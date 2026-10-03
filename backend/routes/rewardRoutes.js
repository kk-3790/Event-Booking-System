const express = require('express');
const router = express.Router();
const {
  getEventDraw,
  createOrUpdateDraw,
  executeDraw,
  applyPromoCode,
  getMyVouchers,
} = require('../controllers/rewardController');
const { protect, authorizeRoles, optionalAuth } = require('../middleware/authMiddleware');

// Public or optional-auth to view draw details & attendee winner vouchers for an event
router.get('/event/:eventId', optionalAuth, getEventDraw);

// Customer promo verification
router.post('/apply-promo', protect, authorizeRoles('CUSTOMER'), applyPromoCode);

// Customer view personal vouchers
router.get('/my-vouchers', protect, authorizeRoles('CUSTOMER'), getMyVouchers);

// Organizer / Admin routes
router.post('/event/:eventId', protect, authorizeRoles('ORGANIZER', 'ADMIN'), createOrUpdateDraw);
router.post('/draw/:id', protect, authorizeRoles('ORGANIZER', 'ADMIN'), executeDraw);

module.exports = router;
