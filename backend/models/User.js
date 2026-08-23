const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    password: { type: String, required: true }, // stored as bcrypt hash
    role: {
      type: String,
      enum: ['ADMIN', 'ORGANIZER', 'CUSTOMER'],
      default: 'CUSTOMER',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
