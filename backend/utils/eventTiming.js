// Combines an event's `date` (Date) with a "HH:MM" time string into one
// real JS Date, so it can be compared against "now" accurately.
const combineDateAndTime = (date, timeString) => {
  const result = new Date(date);
  const [hours, minutes] = (timeString || '00:00').split(':').map(Number);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return result;
};

const getEventStart = (event) => combineDateAndTime(event.date, event.time);

const getEventEnd = (event) => {
  const start = getEventStart(event);
  // If event specifies duration in hours, compute end time by adding duration (handles midnight rollover automatically)
  if (event.duration && Number(event.duration) > 0) {
    return new Date(start.getTime() + Number(event.duration) * 60 * 60 * 1000);
  }
  // Fallback to endTime if provided
  if (event.endTime) {
    const end = combineDateAndTime(event.date, event.endTime);
    // If endTime <= start (e.g. start at 22:00, end at 01:00), it rolled over midnight into the next day!
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    return end;
  }
  // Default to 2 hours duration
  return new Date(start.getTime() + 2 * 60 * 60 * 1000);
};

// Calculates "HH:mm" end time from start time and duration in hours
const calculateEndTime = (startTime, durationHours) => {
  const [sh, sm] = (startTime || '10:00').split(':').map(Number);
  const totalMinutes = (sh || 0) * 60 + (sm || 0) + Math.round(Number(durationHours || 2) * 60);
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMins = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
};

// Figures out what an event's status SHOULD be right now, based on its
// actual start/end time. Does not touch the database — callers decide
// whether/how to persist this.
//   ACTIVE    -> before start time
//   ONGOING   -> between start time and end time
//   COMPLETED -> after end time
// CANCELLED is left untouched — that's a manual, permanent state.
const computeLiveStatus = (event, now = new Date()) => {
  if (event.status === 'CANCELLED' || event.status === 'DELETED') return event.status;

  const start = getEventStart(event);
  const end = getEventEnd(event);

  if (now < start) return 'ACTIVE';
  if (now >= start && now < end) return 'ONGOING';
  return 'COMPLETED';
};

module.exports = { combineDateAndTime, getEventStart, getEventEnd, calculateEndTime, computeLiveStatus };