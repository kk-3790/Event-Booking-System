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

    // Calculate authoritative breakdown
    let unitPrice = booking.unitPrice;
    if (!unitPrice) {
      unitPrice = booking.event.ticketPrice;
      if (booking.isPromotional) {
        try {
          const RewardDraw = require('../models/RewardDraw');
          const draw = await RewardDraw.findOne({ event: booking.event._id, drawStatus: 'OPEN' });
          if (draw && draw.promoTicketPrice) {
            unitPrice = draw.promoTicketPrice;
          } else {
            unitPrice = Math.round(booking.event.ticketPrice * 0.8);
          }
        } catch (e) {
          unitPrice = Math.round(booking.event.ticketPrice * 0.8);
        }
      }
    }

    const subtotal = booking.subtotal || (booking.ticketCount * unitPrice);
    const platformFee = booking.platformFee !== undefined ? booking.platformFee : Math.round(subtotal * 0.05);
    const amount = booking.totalAmount || (subtotal + platformFee);

    // Reuse an existing PENDING payment for this booking if one already
    // exists (e.g. user refreshed the payment page), instead of creating
    // duplicate order records every retry.
    let payment = await Payment.findOne({ booking: booking._id, paymentStatus: 'PENDING' });

    if (payment && payment.amount !== amount) {
      const order = await paymentService.createOrder({
        amountInRupees: amount,
        receiptId: booking._id.toString(),
      });
      payment.amount = amount;
      payment.razorpayOrderId = order.id;
      await payment.save();
    } else if (!payment) {
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
      amount: payment.amount,
      subtotal,
      platformFee,
      currency: 'INR',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_simulated',
      isSimulated: paymentService.isSimulation(),
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
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentMethod } = req.body;

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

      // Dispatch failure notification
      const { sendEmailNotification } = require('../services/notificationService');
      const failedBooking = await Booking.findById(payment.booking._id).populate('user').populate('event');
      if (failedBooking?.user) {
        sendEmailNotification({
          user: failedBooking.user,
          booking: failedBooking,
          type: 'PAYMENT_FAILED',
          message: `Payment authorization failed for your reservation on "${failedBooking.event?.eventName}". Held seats have been released.`,
        }).catch((e) => console.error('Failed to dispatch payment failure notification:', e.message));
      }

      return res.status(400).json({ message: 'Payment verification failed. Seats have been released.' });
    }

    // Payment confirmed genuine — finalize everything
    payment.paymentStatus = 'SUCCESS';
    payment.transactionId = razorpayPaymentId;
    if (paymentMethod) {
      payment.paymentMethod = paymentMethod;
    }
    await payment.save();

    const wasExpired = payment.booking.bookingStatus === 'EXPIRED';
    payment.booking.bookingStatus = 'CONFIRMED';
    payment.booking.cancellationReason = undefined;
    await payment.booking.save();

    if (wasExpired) {
      const eventDoc = await Event.findById(payment.booking.event);
      if (eventDoc) {
        eventDoc.availableSeats = Math.max(0, eventDoc.availableSeats - payment.booking.ticketCount);
        if (payment.booking.tierName && eventDoc.ticketTiers && eventDoc.ticketTiers.length > 0) {
          const tier = eventDoc.ticketTiers.find((t) => t.tierName === payment.booking.tierName);
          if (tier) tier.availableSeats = Math.max(0, tier.availableSeats - payment.booking.ticketCount);
        }
        await eventDoc.save();
      }
    }

    // R.6.3 Generate Payment Receipt
    const receipt = await Receipt.create({
      payment: payment._id,
      amount: payment.amount,
    });

    // Dispatch booking confirmation notification & email
    const { sendEmailNotification } = require('../services/notificationService');
    const confirmedBooking = await Booking.findById(payment.booking._id).populate('user').populate('event');
    if (confirmedBooking?.user) {
      sendEmailNotification({
        user: confirmedBooking.user,
        booking: confirmedBooking,
        type: 'BOOKING_CONFIRMATION',
        message: `Your booking for "${confirmedBooking.event?.eventName}" is confirmed! (${confirmedBooking.ticketCount} passes reserved). Your fast-track QR pass is unlocked in wallet.`,
      }).catch((e) => console.error('Failed to dispatch booking confirmation notification:', e.message));
    }

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

// GET /api/payments/booking/:bookingId  (Customer owner or Admin)
const getPaymentByBooking = async (req, res) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId }).populate({
      path: 'booking',
      populate: { path: 'event', select: 'eventName date venue ticketPrice' },
    });
    if (!payment) {
      return res.status(404).json({ message: 'No payment record found for this booking' });
    }
    if (req.user.role !== 'ADMIN' && payment.booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to view this payment' });
    }
    const receipt = await Receipt.findOne({ payment: payment._id });
    res.status(200).json({ payment, receipt });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payment details', error: err.message });
  }
};

// POST /api/payments/razorpay/webhook  (Called asynchronously by Razorpay)
const handleRazorpayWebhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify HMAC-SHA256 signature if secret and signature are provided
    if (secret && signature) {
      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(req.rawBody || JSON.stringify(req.body));
      const digest = shasum.digest('hex');
      if (digest !== signature) {
        console.warn('⚠️ Webhook signature mismatch');
        return res.status(400).json({ status: 'invalid_signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload || {};

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payment?.entity || {};
      const orderId = paymentEntity.order_id || payload.order?.entity?.id;
      const paymentId = paymentEntity.id;

      let booking = null;
      let existingPayment = null;

      if (orderId) {
        existingPayment = await Payment.findOne({ razorpayOrderId: orderId });
      }

      if (existingPayment) {
        booking = await Booking.findById(existingPayment.booking).populate('event user');
      }

      if (!booking && paymentEntity.notes?.bookingId) {
        booking = await Booking.findById(paymentEntity.notes.bookingId).populate('event user');
      }

      if (booking && (booking.bookingStatus === 'PENDING' || booking.bookingStatus === 'EXPIRED')) {
        const wasExpired = booking.bookingStatus === 'EXPIRED';
        booking.bookingStatus = 'CONFIRMED';
        booking.cancellationReason = undefined;
        await booking.save();

        if (wasExpired) {
          const eventDoc = await Event.findById(booking.event._id || booking.event);
          if (eventDoc) {
            eventDoc.availableSeats = Math.max(0, eventDoc.availableSeats - booking.ticketCount);
            if (booking.tierName && eventDoc.ticketTiers && eventDoc.ticketTiers.length > 0) {
              const tier = eventDoc.ticketTiers.find((t) => t.tierName === booking.tierName);
              if (tier) tier.availableSeats = Math.max(0, tier.availableSeats - booking.ticketCount);
            }
            await eventDoc.save();
          }
        }

        if (existingPayment) {
          existingPayment.paymentStatus = 'SUCCESS';
          existingPayment.transactionId = paymentId || existingPayment.transactionId;
          await existingPayment.save();
        } else {
          existingPayment = await Payment.create({
            booking: booking._id,
            amount: booking.totalAmount || (paymentEntity.amount / 100),
            paymentMethod: paymentEntity.method?.toUpperCase() || 'RAZORPAY_WEBHOOK',
            paymentStatus: 'SUCCESS',
            transactionId: paymentId || `pay_wh_${Date.now()}`,
            razorpayOrderId: orderId,
          });
        }

        // Generate receipt if not existing
        let receipt = await Receipt.findOne({ payment: existingPayment._id });
        if (!receipt) {
          receipt = await Receipt.create({
            payment: existingPayment._id,
            amount: existingPayment.amount || booking.totalAmount,
            generatedDate: new Date(),
          });
        }

        // Add to lucky draw if promotional
        if (booking.isPromotional) {
          try {
            const RewardDraw = require('../models/RewardDraw');
            await RewardDraw.findOneAndUpdate(
              { event: booking.event._id, drawStatus: 'OPEN' },
              { $addToSet: { participants: booking.user._id } }
            );
          } catch (e) {
            console.error('Webhook: Lucky draw enrollment error:', e.message);
          }
        }

        // Dispatch confirmation email
        try {
          const { sendEmailNotification } = require('../services/notificationService');
          sendEmailNotification({
            user: booking.user,
            booking: booking,
            type: 'BOOKING_CONFIRMATION',
            message: `Your booking for "${booking.event?.eventName}" has been confirmed via gateway webhook!`,
          }).catch((e) => console.error('Webhook notification dispatch failed:', e.message));
        } catch (e) {
          // notification ignore
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment?.entity || {};
      const orderId = paymentEntity.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment) {
          payment.paymentStatus = 'FAILED';
          await payment.save();
          await Booking.findByIdAndUpdate(payment.booking, { bookingStatus: 'PAYMENT_FAILED' });
        }
      }
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ message: 'Webhook processing error', error: err.message });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  getPaymentByBooking,
  handleRazorpayWebhook,
};