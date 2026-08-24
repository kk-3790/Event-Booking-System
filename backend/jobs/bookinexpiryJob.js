const cron = require('node-cron');
const Booking = require('../models/Booking');
const Event = require('../models/Event');

// Runs every 2 minutes (more frequent than the hourly event job, since the
// booking hold window is only 10 minutes — a coarser check would let seats
// stay locked too long after a user abandons checkout).
//
// Finds every PENDING booking whose expiresAt has passed, marks it EXPIRED,
// and releases its seats back to the event. This is the background backstop
// for cases where nobody happens to view/act on the booking directly (the
// controllers also do this same check live, on read/cancel).
const startBookingExpiryJob = () => {
  cron.schedule('*/2 * * * *', async () => {
    try {
      const expiredBookings = await Booking.find({
        bookingStatus: 'PENDING',
        expiresAt: { $lt: new Date() },
      });

      if (expiredBookings.length === 0) return;

      await Promise.all(
        expiredBookings.map(async (booking) => {
          booking.bookingStatus = 'EXPIRED';
          await booking.save();
          await Event.findByIdAndUpdate(booking.event, {
            $inc: { availableSeats: booking.ticketCount },
          });
        })
      );

      console.log(`Expired ${expiredBookings.length} stale PENDING booking(s), seats released`);
    } catch (err) {
      console.error('Booking expiry job failed:', err.message);
    }
  });
};

module.exports = startBookingExpiryJob;