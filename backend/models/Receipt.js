const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    generatedDate: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Receipt', receiptSchema);