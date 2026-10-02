const express = require('express');
const router = express.Router();
const {
  generateBookingReport,
  generateEventReport,
  getReportHistory,
  getReportById,
} = require('../controllers/reportController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Accessible by Admins and Organizers (Organizers see only their own data)
router.use(protect, authorizeRoles('ADMIN', 'ORGANIZER'));

router.get('/bookings', generateBookingReport);
router.get('/events', generateEventReport);
router.get('/', getReportHistory);
router.get('/:id', getReportById);

module.exports = router;