const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String }, // created before payment happens
    transactionId: { type: String }, // Razorpay payment ID, set after payment completes
    paymentMethod: { type: String, default: 'UPI' }, // UPI, Card, Netbanking, etc.
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    refundId: { type: String },
    refundAmount: { type: Number },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);