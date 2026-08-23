const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// R.1.1 Register User
// POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ message: 'Name, email, mobile, and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({ message: 'A user with this mobile number already exists' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      mobile,
      password: hashedPassword,
      role: role && ['ADMIN', 'ORGANIZER', 'CUSTOMER'].includes(role) ? role : 'CUSTOMER',
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'User account created successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

// R.1.2 Login
// POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// R.1.3 Logout
// POST /api/auth/logout
// JWT is stateless, so "logout" is handled client-side by discarding the token.
// This endpoint exists for consistency with the SRS and can be extended later
// with a token blacklist if needed.
const logoutUser = async (req, res) => {
  res.status(200).json({ message: 'User is logged out successfully' });
};

module.exports = { registerUser, loginUser, logoutUser };