const express = require('express');
const router = express.Router();
const {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventById,
  searchEvents,
} = require('../controllers/eventController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllEvents);
router.get('/search', searchEvents); // must come before /:id so "search" isn't treated as an ID
router.get('/:id', getEventById);

// Protected routes (Organizer/Admin only)
router.post('/', protect, authorizeRoles('ORGANIZER', 'ADMIN'), createEvent);
router.put('/:id', protect, authorizeRoles('ORGANIZER', 'ADMIN'), updateEvent);
router.delete('/:id', protect, authorizeRoles('ORGANIZER', 'ADMIN'), deleteEvent);

module.exports = router;