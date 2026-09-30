const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    eventName: { type: String, required: true, trim: true, unique: true },
    category: { type: String, required: true, trim: true },
    venue: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true }, // start time, e.g. "18:30"
    endTime: { type: String, required: true }, // end time, e.g. "21:00"
    ticketPrice: { type: Number, required: true, min: 0 },
    totalSeats: { type: Number, min: 0 },
    availableSeats: { type: Number, required: true, min: 0 },
    bannerImage: { type: String },
    description: { type: String, default: '' },
    ticketTiers: [
      {
        tierName: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        totalSeats: { type: Number, required: true, min: 1 },
        availableSeats: { type: Number, required: true, min: 0 },
        perks: { type: String, default: '' },
      },
    ],
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'ONGOING', 'CANCELLED', 'COMPLETED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

// Helpful for R.3.5 Search and Filter Events
eventSchema.index({ eventName: 'text', category: 'text', venue: 'text' });

module.exports = mongoose.model('Event', eventSchema);