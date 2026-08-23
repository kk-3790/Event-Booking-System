const cron = require('node-cron');
const Event = require('../models/Event');
const { computeLiveStatus } = require('../utils/eventTiming');

// Runs once every hour. Syncs each ACTIVE/ONGOING event's stored status with
// its real-time status based on start/end time:
//   ACTIVE    -> before start time
//   ONGOING   -> between start time and end time
//   COMPLETED -> after end time
// Events are never deleted — past events stay in the database so booking
// history (R.4.3) and admin reports (R.8) keep working correctly; they're
// just excluded from public browse/search results once no longer ACTIVE.
const startEventCompletionJob = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const candidates = await Event.find({ status: { $in: ['ACTIVE', 'ONGOING'] } });

      const updates = candidates
        .map((event) => ({ event, liveStatus: computeLiveStatus(event, now) }))
        .filter(({ event, liveStatus }) => event.status !== liveStatus);

      if (updates.length > 0) {
        await Promise.all(
          updates.map(({ event, liveStatus }) =>
            Event.updateOne({ _id: event._id }, { $set: { status: liveStatus } })
          )
        );
        console.log(`Synced status for ${updates.length} event(s)`);
      }
    } catch (err) {
      console.error('Event completion job failed:', err.message);
    }
  });
};

module.exports = startEventCompletionJob;