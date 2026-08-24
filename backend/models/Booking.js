const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    bookingDate: { type: Date, default: Date.now },
    ticketCount: { type: Number, required: true, min: 1 },
    bookingStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED', 'EXPIRED'],
      default: 'PENDING',
    },
    // A PENDING booking must be paid for before this time, or it is
    // automatically expired and its seats released back to the event.
    // Set to bookingDate + 10 minutes when the booking is created.
    expiresAt: { type: Date },
    // set true if this booking was made via the Lucky Discount / Reward Draw promo ticket
    isPromotional: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);