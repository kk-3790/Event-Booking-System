const express = require('express');
const router = express.Router();
const {
  generateBookingReport,
  generateEventReport,
  getReportHistory,
  getReportById,
} = require('../controllers/reportController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Every route here is restricted to Admins only
router.use(protect, authorizeRoles('ADMIN'));

router.get('/bookings', generateBookingReport);
router.get('/events', generateEventReport);
router.get('/', getReportHistory);
router.get('/:id', getReportById);

module.exports = router;