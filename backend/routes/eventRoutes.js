const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventById,
  searchEvents,
} = require('../controllers/eventController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Storage for custom event banner posters
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'banners'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `banner_${Date.now()}_${cleanBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, webp, gif) up to 5MB are allowed!'));
  },
});

// Public routes
router.get('/', getAllEvents);
router.get('/search', searchEvents); // must come before /:id so "search" isn't treated as an ID
router.get('/:id', getEventById);

// Protected routes (Organizer/Admin only)
router.post(
  '/upload-banner',
  protect,
  authorizeRoles('ORGANIZER', 'ADMIN'),
  upload.single('banner'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    const imageUrl = `/uploads/banners/${req.file.filename}`;
    res.status(200).json({
      message: 'Banner image uploaded successfully',
      imageUrl,
    });
  }
);

router.post('/', protect, authorizeRoles('ORGANIZER', 'ADMIN'), createEvent);
router.put('/:id', protect, authorizeRoles('ORGANIZER', 'ADMIN'), updateEvent);
router.delete('/:id', protect, authorizeRoles('ORGANIZER', 'ADMIN'), deleteEvent);

module.exports = router;