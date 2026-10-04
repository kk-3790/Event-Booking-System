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
 * Formats a start and end time into an Indian 12h time range (e.g. "10:00 AM – 6:00 PM").
 */
export const formatTimeRange12h = (startTime, endTime) => {
  if (!startTime && !endTime) return '';
  if (!endTime) return formatTime12h(startTime);
  if (!startTime) return formatTime12h(endTime);
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
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
