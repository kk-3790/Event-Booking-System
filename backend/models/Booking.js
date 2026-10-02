const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    bookingDate: { type: Date, default: Date.now },
    bookingTime: { type: String }, // formatted time string, e.g. "05:14 PM"
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
    promoCode: { type: String },
    // Authoritative pricing breakdown
    unitPrice: { type: Number },
    subtotal: { type: Number },
    platformFee: { type: Number, default: 0 },
    totalAmount: { type: Number },
    // Multi-tier pass name
    tierName: { type: String, default: 'General Admission' },
    // Gate admission & check-in verification
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Generated scannable QR code data URL (encoded at booking time)
    qrCode: { type: String },
    // Cancellation & Refund tracking
    cancellationReason: { type: String },
    refundStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'PROCESSED', 'FAILED'],
      default: 'NONE',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);