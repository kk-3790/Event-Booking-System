const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getPaymentStatus } = require('../controllers/paymentController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/create-order', protect, authorizeRoles('CUSTOMER'), createOrder);
router.post('/verify', protect, authorizeRoles('CUSTOMER'), verifyPayment);
router.get('/:id', protect, getPaymentStatus);

module.exports = router;