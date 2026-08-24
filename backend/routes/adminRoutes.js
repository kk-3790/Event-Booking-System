const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  getAllBookings,
  getAllEventsForAdmin,
  getDashboardStats,
} = require('../controllers/adminController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Every route here is restricted to Admins only
router.use(protect, authorizeRoles('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.get('/bookings', getAllBookings);
router.get('/events', getAllEventsForAdmin);

module.exports = router;