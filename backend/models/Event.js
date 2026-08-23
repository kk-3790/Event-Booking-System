const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    eventName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    venue: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true }, // e.g. "18:30"
    ticketPrice: { type: Number, required: true, min: 0 },
    availableSeats: { type: Number, required: true, min: 0 },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'CANCELLED', 'COMPLETED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

// Helpful for R.3.5 Search and Filter Events
eventSchema.index({ eventName: 'text', category: 'text', venue: 'text' });

module.exports = mongoose.model('Event', eventSchema);