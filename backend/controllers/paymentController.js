const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Receipt = require('../models/Receipt');
const paymentService = require('../services/paymentService');

// R.6.1 Process Ticket Payment (step 1: create the order)
// POST /api/payments/create-order  (Customer, owner of the booking)
const createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' });
    }

    const booking = await Booking.findById(bookingId).populate('event');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to pay for this booking' });
    }

    // Catch a booking that has already expired but hasn't been swept by the
    // cron job yet — same live-check pattern used elsewhere in the app.
    if (booking.bookingStatus === 'PENDING' && booking.expiresAt && booking.expiresAt < new Date()) {
      booking.bookingStatus = 'EXPIRED';
      await booking.save();
      await Event.findByIdAndUpdate(booking.event._id, { $inc: { availableSeats: booking.ticketCount } });
    }

    if (booking.bookingStatus !== 'PENDING') {
      return res.status(400).json({ message: `This booking is ${booking.bookingStatus.toLowerCase()} and cannot be paid for` });
    }

    const amount = booking.ticketCount * booking.event.ticketPrice;

    // Reuse an existing PENDING payment for this booking if one already
    // exists (e.g. user refreshed the payment page), instead of creating
    // duplicate order records every retry.
    let payment = await Payment.findOne({ booking: booking._id, paymentStatus: 'PENDING' });

    if (!payment) {
      const order = await paymentService.createOrder({
        amountInRupees: amount,
        receiptId: booking._id.toString(),
      });

      payment = await Payment.create({
        booking: booking._id,
        amount,
        razorpayOrderId: order.id,
        paymentStatus: 'PENDING',
      });
    }

    res.status(201).json({
      message: 'Order created, proceed to payment',
      razorpayOrderId: payment.razorpayOrderId,
      amount,
      currency: 'INR',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID, // frontend checkout widget needs this
      paymentId: payment._id,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create payment order', error: err.message });
  }
};

// R.6.2 Verify Payment Transaction (step 2: after Razorpay checkout completes)
// POST /api/payments/verify  (Customer, owner of the booking)
const verifyPayment = async (req, res) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!paymentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'Missing required payment verification fields' });
    }

    const payment = await Payment.findById(paymentId).populate('booking');
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }
    if (payment.booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to verify this payment' });
    }
    if (payment.paymentStatus !== 'PENDING') {
      return res.status(400).json({ message: `This payment is already ${payment.paymentStatus.toLowerCase()}` });
    }

    // R.6.4 Handle Failed Payment — verify the signature actually came from
    // Razorpay, not a client just claiming success. Never trust the
    // frontend's word alone for something as important as payment.
    const isValid = paymentService.verifySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      payment.paymentStatus = 'FAILED';
      await payment.save();

      payment.booking.bookingStatus = 'PAYMENT_FAILED';
      await payment.booking.save();

      // Release the held seats back since payment failed
      await Event.findByIdAndUpdate(payment.booking.event, {
        $inc: { availableSeats: payment.booking.ticketCount },
      });

      return res.status(400).json({ message: 'Payment verification failed. Seats have been released.' });
    }

    // Payment confirmed genuine — finalize everything
    payment.paymentStatus = 'SUCCESS';
    payment.transactionId = razorpayPaymentId;
    await payment.save();

    payment.booking.bookingStatus = 'CONFIRMED';
    await payment.booking.save();

    // R.6.3 Generate Payment Receipt
    const receipt = await Receipt.create({
      payment: payment._id,
      amount: payment.amount,
    });

    res.status(200).json({
      message: 'Payment successful, booking confirmed',
      payment,
      receipt,
    });
  } catch (err) {
    res.status(500).json({ message: 'Payment verification failed', error: err.message });
  }
};

// GET /api/payments/:id  (Customer, owner of the booking, or Admin)
const getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate({
      path: 'booking',
      populate: { path: 'event', select: 'eventName date venue' },
    });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    if (req.user.role !== 'ADMIN' && payment.booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to view this payment' });
    }
    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payment status', error: err.message });
  }
};

module.exports = { createOrder, verifyPayment, getPaymentStatus };