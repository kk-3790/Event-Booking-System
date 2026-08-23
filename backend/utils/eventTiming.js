// Combines an event's `date` (Date) with a "HH:MM" time string into one
// real JS Date, so it can be compared against "now" accurately.
const combineDateAndTime = (date, timeString) => {
    const result = new Date(date);
    const [hours, minutes] = (timeString || '00:00').split(':').map(Number);
    result.setHours(hours || 0, minutes || 0, 0, 0);
    return result;
  };
  
  const getEventStart = (event) => combineDateAndTime(event.date, event.time);
  const getEventEnd = (event) => combineDateAndTime(event.date, event.endTime);
  
  // Figures out what an event's status SHOULD be right now, based on its
  // actual start/end time. Does not touch the database — callers decide
  // whether/how to persist this.
  //   ACTIVE    -> before start time
  //   ONGOING   -> between start time and end time
  //   COMPLETED -> after end time
  // CANCELLED is left untouched — that's a manual, permanent state.
  const computeLiveStatus = (event, now = new Date()) => {
    if (event.status === 'CANCELLED') return 'CANCELLED';
  
    const start = getEventStart(event);
    const end = getEventEnd(event);
  
    if (now < start) return 'ACTIVE';
    if (now >= start && now < end) return 'ONGOING';
    return 'COMPLETED';
  };
  
  module.exports = { combineDateAndTime, getEventStart, getEventEnd, computeLiveStatus };