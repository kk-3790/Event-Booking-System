const mongoose = require('mongoose');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        EMAIL_REGEX,
        'Please enter a valid email address (e.g. name@gmail.com)',
      ],
    },
    mobile: { type: String, required: [true, 'Mobile number is required'], unique: true, trim: true },
    password: { type: String, required: [true, 'Password is required'] }, // stored as bcrypt hash
    role: {
      type: String,
      enum: ['ADMIN', 'ORGANIZER', 'CUSTOMER'],
      default: 'CUSTOMER',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
