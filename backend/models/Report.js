const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reportType: { type: String, enum: ['BOOKING', 'EVENT'], required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Admin
    generatedDate: { type: Date, default: Date.now },
    // filters used to generate the report, kept flexible
    dateRangeStart: { type: Date },
    dateRangeEnd: { type: Date },
    eventFilter: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    data: { type: mongoose.Schema.Types.Mixed }, // the actual generated report payload
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);