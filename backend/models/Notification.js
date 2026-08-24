const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    type: {
      type: String,
      enum: ['BOOKING_CONFIRMATION', 'EVENT_REMINDER', 'EVENT_UPDATE', 'PAYMENT_FAILED', 'DRAW_RESULT'],
      required: true,
    },
    message: { type: String, required: true },
    channel: { type: String, enum: ['EMAIL', 'SMS'], default: 'EMAIL' },
    status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
    providerResponseId: { type: String }, // message ID returned by email/SMS provider
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);

