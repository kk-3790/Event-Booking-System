/**
 * Indian Standard (IST / en-IN) Date & Time Formatting Utilities
 */

/**
 * Converts a 24-hour time string ("HH:mm", e.g. "18:30" or "10:00")
 * into Indian 12-hour format with AM/PM (e.g. "6:30 PM" or "10:00 AM").
 */
export const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();
  // Already in 12h format
  if (trimmed.toLowerCase().includes('am') || trimmed.toLowerCase().includes('pm')) {
    return trimmed;
  }
  const [hStr, mStr] = trimmed.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : '00';
  if (isNaN(h)) return trimmed;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
};

/**
 * Calculates end time string ("HH:mm") from start time and duration (hours).
 */
export const calculateEndTime = (startTime, durationHours) => {
  if (!startTime) return '';
  const [sh, sm] = String(startTime).split(':').map(Number);
  const totalMins = (sh || 0) * 60 + (sm || 0) + Math.round(Number(durationHours || 2) * 60);
  const endHours = Math.floor(totalMins / 60) % 24;
  const endMins = totalMins % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
};

/**
 * Formats a calculated end time preview with 12h time and optional "(+1 day)" indicator for overnight events.
 */
export const formatCalculatedEndTime = (startTime, durationHours) => {
  if (!startTime) return '';
  const [sh, sm] = String(startTime).split(':').map(Number);
  const durNum = Number(durationHours) || 2;
  const totalMins = (sh || 0) * 60 + (sm || 0) + Math.round(durNum * 60);
  const daysAdded = Math.floor(totalMins / (24 * 60));
  const endHours = Math.floor(totalMins / 60) % 24;
  const endMins = totalMins % 60;
  const timeStr = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
  const formatted12h = formatTime12h(timeStr);
  if (daysAdded > 0) {
    return `${formatted12h} (+${daysAdded} day${daysAdded > 1 ? 's' : ''})`;
  }
  return formatted12h;
};

/**
 * Formats a start and end time into an Indian 12h time range (e.g. "10:00 AM – 6:00 PM").
 */
export const formatTimeRange12h = (startTime, endTime) => {
  if (!startTime && !endTime) return '';
  if (!endTime) return formatTime12h(startTime);
  if (!startTime) return formatTime12h(endTime);
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
};

/**
 * Formats event timing with duration and start/end schedule.
 * Correctly presents overnight events (e.g. "10:00 PM – 1:00 AM (+1 day) (3 hrs)").
 */
export const formatEventSchedule = (startTime, durationHours, endTime) => {
  if (!startTime) return '';
  const start12h = formatTime12h(startTime);
  if (durationHours && Number(durationHours) > 0) {
    const endFormatted = formatCalculatedEndTime(startTime, durationHours);
    const durText = `${durationHours} ${Number(durationHours) === 1 ? 'hr' : 'hrs'}`;
    return `${start12h} – ${endFormatted} (${durText})`;
  }
  if (endTime) {
    return formatTimeRange12h(startTime, endTime);
  }
  return start12h;
};

/**
 * Formats a date into Indian standard format (e.g. "Sun, 18 Oct 2026" or "18 Oct 2026").
 * Always places Day before Month (DD MMM YYYY).
 */
export const formatEventDate = (dateVal, withWeekday = true) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  if (withWeekday) {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdays[d.getDay()];
    return `${weekday}, ${day} ${month} ${year}`;
  }
  return `${day} ${month} ${year}`;
};

/**
 * Formats a date timestamp into Indian date & 12h time (e.g. "18 Oct 2026, 06:30 PM").
 */
export const formatDateTime = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  const datePart = formatEventDate(d, false);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${datePart}, ${hours}:${minutes} ${period}`;
};

/**
 * Formats a date timestamp into 12-hour time only (e.g. "06:30 PM").
 */
export const formatTimestampTime = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${period}`;
};

/**
 * Combines an event's date and "HH:mm" time string into a JavaScript Date object.
 */
export const combineDateAndTime = (dateVal, timeStr) => {
  if (!dateVal) return new Date();
  const d = new Date(dateVal);
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

/**
 * Returns the JavaScript Date when an event starts.
 */
export const getEventStart = (event) => {
  if (!event) return new Date();
  return combineDateAndTime(event.date, event.time);
};

/**
 * Returns the JavaScript Date when an event ends.
 * Automatically handles overnight events crossing midnight into the next day.
 */
export const getEventEnd = (event) => {
  if (!event) return new Date();
  const start = getEventStart(event);
  if (event.duration && Number(event.duration) > 0) {
    return new Date(start.getTime() + Number(event.duration) * 60 * 60 * 1000);
  }
  if (event.endTime) {
    const end = combineDateAndTime(event.date, event.endTime);
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    return end;
  }
  return new Date(start.getTime() + 2 * 60 * 60 * 1000);
};

/**
 * Checks if the event has ended.
 */
export const isEventPastEnd = (event, now = new Date()) => {
  if (!event?.date) return false;
  return now > getEventEnd(event);
};

/**
 * Checks if the event has started.
 */
export const isEventStarted = (event, now = new Date()) => {
  if (!event?.date) return false;
  return now >= getEventStart(event);
};
