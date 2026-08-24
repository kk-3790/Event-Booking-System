const express = require('express');
const router = express.Router();
const {
  bookTicket,
  cancelBooking,
  getMyBookings,
  getBookingById,
} = require('../controllers/bookingController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// All booking routes require login
router.post('/', protect, authorizeRoles('CUSTOMER'), bookTicket);
router.get('/my', protect, getMyBookings);
router.get('/:id', protect, getBookingById);
router.delete('/:id', protect, cancelBooking);

module.exports = router;