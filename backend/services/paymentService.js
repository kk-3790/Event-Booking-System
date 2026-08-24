const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialized lazily (on first actual use) rather than at import time, so
// the server doesn't crash on boot if RAZORPAY_KEY_ID/SECRET aren't set in
// .env yet — you'll only get an error when a payment is actually attempted,
// with a clear message pointing at what's missing.
let razorpayInstance = null;
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env to process payments');
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
};

// Creates a Razorpay order for the given amount (in rupees). Razorpay
// expects the amount in paise (smallest currency unit), so we convert here
// once, in the one place that talks to Razorpay directly.
const createOrder = async ({ amountInRupees, receiptId }) => {
  const order = await getRazorpayInstance().orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: 'INR',
    receipt: receiptId,
  });
  return order; // { id, amount, currency, ... }
};

// Verifies that a payment response actually came from Razorpay and wasn't
// forged/tampered with, by recomputing the HMAC SHA256 signature using our
// secret key and comparing it to what was sent back. This is the step that
// prevents trusting a client that just claims "payment successful" without
// proof — a real security gap if skipped.
const verifySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  return expectedSignature === razorpaySignature;
};

module.exports = { createOrder, verifySignature };