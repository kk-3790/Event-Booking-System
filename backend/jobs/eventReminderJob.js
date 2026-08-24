const cron = require('node-cron');
const Booking = require('../models/Booking');
const { sendEmailNotification } = require('../services/notificationService');

// Runs once daily at 9 AM. Finds all CONFIRMED bookings for events
// happening in the next 24 hours and sends a reminder email to each user.
// R.7.2 Event Reminder.
const startEventReminderJob = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const upcomingBookings = await Booking.find({ bookingStatus: 'CONFIRMED' })
        .populate('event')
        .populate('user');

      const dueReminders = upcomingBookings.filter((booking) => {
        if (!booking.event) return false;
        const eventDate = new Date(booking.event.date);
        return eventDate >= now && eventDate <= tomorrow;
      });

      for (const booking of dueReminders) {
        await sendEmailNotification({
          user: booking.user,
          booking,
          type: 'EVENT_REMINDER',
          message: `Reminder: "${booking.event.eventName}" is happening soon on ${new Date(booking.event.date).toDateString()} at ${booking.event.time}. See you there!`,
        }).catch((err) => console.error('Reminder notification error:', err.message));
      }

      if (dueReminders.length > 0) {
        console.log(`Sent ${dueReminders.length} event reminder(s)`);
      }
    } catch (err) {
      console.error('Event reminder job failed:', err.message);
    }
  });
};

module.exports = startEventReminderJob;