const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Receipt = require('../models/Receipt');
const { fetchOrderPayments } = require('../services/paymentService');

const BOOKING_HOLD_MINUTES = process.env.BOOKING_HOLD_MINUTES ? parseInt(process.env.BOOKING_HOLD_MINUTES) : 10;

/**
 * Checks a booking before expiring it.
 * Verifies if:
 * 1. Booking is already CONFIRMED -> Cleans up any stale cancellationReason and leaves it confirmed.
 * 2. Booking is PENDING and expired ->
 *    a) Checks MongoDB Payment collection for paymentStatus === 'SUCCESS'.
 *    b) Checks Razorpay orders.fetchPayments for captured/authorized transactions.
 *    c) If paid, reconciles to CONFIRMED and does NOT expire.
 *    d) If genuinely unpaid, transitions to EXPIRED, releases seats back to the event.
 */
const expireIfNeeded = async (booking) => {
  if (!booking) return booking;

  // 1. If already confirmed, ensure no leftover cancellation reason
  if (booking.bookingStatus === 'CONFIRMED') {
    if (booking.cancellationReason) {
      booking.cancellationReason = undefined;
      await booking.save();
    }
    return booking;
  }

  // 2. Only PENDING bookings can expire
  if (booking.bookingStatus !== 'PENDING') {
    return booking;
  }

  // 3. Check if 10-minute hold has elapsed
  if (!booking.expiresAt || new Date(booking.expiresAt).getTime() > Date.now()) {
    return booking;
  }

  // 4. CHECK BEFORE EXPIRING: Did payment succeed in DB?
  const successPayment = await Payment.findOne({
    booking: booking._id,
    paymentStatus: 'SUCCESS',
  });

  if (successPayment) {
    booking.bookingStatus = 'CONFIRMED';
    booking.cancellationReason = undefined;
    await booking.save();
    return booking;
  }

  // 5. CHECK BEFORE EXPIRING: Did customer complete payment on Razorpay?
  const pendingPayment = await Payment.findOne({
    booking: booking._id,
    paymentStatus: 'PENDING',
  }).sort({ createdAt: -1 });

  if (pendingPayment && pendingPayment.razorpayOrderId) {
    try {
      const items = await fetchOrderPayments(pendingPayment.razorpayOrderId);
      const paidItem = items.find(
        (p) => p.status === 'captured' || p.status === 'authorized'
      );

      if (paidItem) {
        pendingPayment.paymentStatus = 'SUCCESS';
        pendingPayment.transactionId = paidItem.id;
        if (paidItem.method) {
          pendingPayment.paymentMethod = paidItem.method.toUpperCase();
        }
        await pendingPayment.save();

        booking.bookingStatus = 'CONFIRMED';
        booking.cancellationReason = undefined;
        await booking.save();

        // Ensure receipt is generated
        const existingReceipt = await Receipt.findOne({ payment: pendingPayment._id });
        if (!existingReceipt) {
          await Receipt.create({
            payment: pendingPayment._id,
            amount: pendingPayment.amount,
          });
        }

        // Send confirmation email/alert
        try {
          const { sendEmailNotification } = require('../services/notificationService');
          const confirmedBkg = await Booking.findById(booking._id).populate('user event');
          if (confirmedBkg?.user) {
            sendEmailNotification({
              user: confirmedBkg.user,
              booking: confirmedBkg,
              type: 'BOOKING_CONFIRMATION',
              message: `Your booking for "${confirmedBkg.event?.eventName}" is confirmed! (${confirmedBkg.ticketCount} passes reserved). Fast-track QR pass is unlocked in wallet.`,
            }).catch(() => {});
          }
        } catch (_) {}

        return booking;
      }
    } catch (err) {
      console.warn(`[Check before expire] Could not verify Razorpay payments for order ${pendingPayment.razorpayOrderId}:`, err.message);
    }
  }

  // 6. Genuinely unpaid hold expired: mark EXPIRED and release seats back to the event
  booking.bookingStatus = 'EXPIRED';
  booking.cancellationReason = `Hold Expired: Checkout window (${BOOKING_HOLD_MINUTES} minutes) elapsed without payment. Reserved seats were automatically released.`;
  await booking.save();

  const event = await Event.findById(booking.event);
  if (event) {
    event.availableSeats += booking.ticketCount;
    if (booking.tierName && event.ticketTiers && event.ticketTiers.length > 0) {
      const tier = event.ticketTiers.find((t) => t.tierName === booking.tierName);
      if (tier) tier.availableSeats += booking.ticketCount;
    }
    await event.save();
  }

  return booking;
};

module.exports = { expireIfNeeded, BOOKING_HOLD_MINUTES };
