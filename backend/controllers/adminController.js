const User = require('../models/User');
const Booking = require('../models/Booking');
const Event = require('../models/Event');

// R.2.1 View Users
// GET /api/admin/users  (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role.toUpperCase();

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
};

// View a single user's profile (Admin only)
// GET /api/admin/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user', error: err.message });
  }
};

// R.2.2 View Bookings
// GET /api/admin/bookings  (Admin only)
// Supports optional filters: ?status=CONFIRMED  ?eventId=...  ?userId=...
const getAllBookings = async (req, res) => {
  try {
    const { status, eventId, userId } = req.query;
    const filter = {};
    if (status) filter.bookingStatus = status.toUpperCase();
    if (eventId) filter.event = eventId;
    if (userId) filter.user = userId;

    const bookings = await Booking.find(filter)
      .populate('user', 'name email mobile')
      .populate('event', 'eventName date time venue ticketPrice')
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings', error: err.message });
  }
};

// View all events regardless of status (Admin only) — the public /api/events
// route only shows ACTIVE events, but an admin needs to see everything
// (ONGOING, COMPLETED, CANCELLED too) for oversight.
// GET /api/admin/events
const getAllEventsForAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();

    const events = await Event.find(filter).populate('organizer', 'name email').sort({ createdAt: -1 });
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch events', error: err.message });
  }
};

// Basic platform-wide stats for an admin dashboard overview
// GET /api/admin/stats
const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalOrganizers, totalCustomers, totalEvents, activeEvents, totalBookings, confirmedBookings] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'ORGANIZER' }),
        User.countDocuments({ role: 'CUSTOMER' }),
        Event.countDocuments(),
        Event.countDocuments({ status: 'ACTIVE' }),
        Booking.countDocuments(),
        Booking.countDocuments({ bookingStatus: 'CONFIRMED' }),
      ]);

    res.status(200).json({
      totalUsers,
      totalOrganizers,
      totalCustomers,
      totalEvents,
      activeEvents,
      totalBookings,
      confirmedBookings,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch dashboard stats', error: err.message });
  }
};

module.exports = { getAllUsers, getUserById, getAllBookings, getAllEventsForAdmin, getDashboardStats };