const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');

// Initialized lazily, same pattern as paymentService — avoids crashing the
// server on boot if EMAIL_USER/EMAIL_PASS aren't set in .env yet.
let transporter = null;
const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in .env to send notifications');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // must be a Gmail App Password, not your real password
      },
    });
  }
  return transporter;
};

const SUBJECT_LINES = {
  BOOKING_CONFIRMATION: 'Your booking is confirmed!',
  EVENT_REMINDER: 'Reminder: your event is coming up',
  EVENT_UPDATE: 'An event you booked has been updated',
  PAYMENT_FAILED: 'Payment failed for your booking',
  DRAW_RESULT: 'Your Lucky Discount Draw result',
};

// Creates a Notification record first (status PENDING), attempts to send
// the email, then updates the record to SENT or FAILED based on the
// outcome. A send failure here never throws back to the caller — booking/
// payment confirmation should never fail just because an email didn't go
// out, so this is deliberately fire-and-forget from the caller's side.
const sendEmailNotification = async ({ user, booking, type, message }) => {
  const notification = await Notification.create({
    user: user._id,
    booking: booking ? booking._id : undefined,
    type,
    message,
    channel: 'EMAIL',
    status: 'PENDING',
  });

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: SUBJECT_LINES[type] || 'Event Booking System Notification',
      text: message,
    });

    notification.status = 'SENT';
    notification.providerResponseId = info.messageId;
    await notification.save();
  } catch (err) {
    notification.status = 'FAILED';
    await notification.save();
    console.error(`Notification send failed (${type} to ${user.email}):`, err.message);
  }

  return notification;
};

module.exports = { sendEmailNotification };