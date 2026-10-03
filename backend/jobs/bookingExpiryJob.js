const cron = require('node-cron');
const Booking = require('../models/Booking');
const Event = require('../models/Event');

const { expireIfNeeded } = require('../utils/bookingExpiry');

// Runs every minute.
// Finds every PENDING booking whose expiresAt has passed, checks if payment was
// already made/captured, and only if genuinely unpaid marks it EXPIRED and releases seats.
const startBookingExpiryJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const staleBookings = await Booking.find({
        bookingStatus: 'PENDING',
        expiresAt: { $lt: new Date() },
      });

      if (staleBookings.length === 0) return;

      await Promise.all(
        staleBookings.map(async (booking) => {
          await expireIfNeeded(booking);
        })
      );

      console.log(`Reconciled ${staleBookings.length} stale PENDING booking(s) with payment check`);
    } catch (err) {
      console.error('Booking expiry job failed:', err.message);
    }
  });
};

module.exports = startBookingExpiryJob;