require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const startEventCompletionJob = require('./jobs/eventCompletionJob');
const startBookingExpiryJob = require('./jobs/bookingExpiryJob');
const startEventReminderJob = require('./jobs/eventReminderJob');

const path = require('path');
const fs = require('fs');

const app = express();

// Ensure uploads/banners directory exists
const uploadDir = path.join(__dirname, 'uploads', 'banners');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Connect to MongoDB Atlas
connectDB();

// Start background jobs
startEventCompletionJob();
startBookingExpiryJob();
startEventReminderJob();

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/rewards', rewardRoutes);

app.get('/', (req, res) => {
  res.send('Event Booking System API is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});