const mongoose = require('mongoose');

const rewardDrawSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    promoTicketPrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, required: true, min: 0, max: 100 },
    numberOfWinners: { type: Number, required: true, min: 1 },
    // users who bought a promotional ticket and are eligible for the draw
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    winners: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    drawStatus: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'COMPLETED'],
      default: 'OPEN',
    },
    drawDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RewardDraw', rewardDrawSchema);