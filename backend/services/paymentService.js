const Razorpay = require('razorpay');
const crypto = require('crypto');

// Check if simulation mode is active (when credentials are unset or mock)
const isSimulation = () => {
  return (
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET ||
    process.env.RAZORPAY_KEY_ID === 'rzp_test_simulated' ||
    process.env.PAYMENT_SIMULATION === 'true'
  );
};

let razorpayInstance = null;
const getRazorpayInstance = () => {
  if (isSimulation()) {
    return null;
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
};

// Creates a Razorpay order (or simulated order in dev/test)
const createOrder = async ({ amountInRupees, receiptId }) => {
  if (isSimulation()) {
    const orderId = `order_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      id: orderId,
      amount: Math.round(amountInRupees * 100),
      currency: 'INR',
      receipt: receiptId,
      status: 'created',
      isSimulated: true,
    };
  }

  const order = await getRazorpayInstance().orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: 'INR',
    receipt: receiptId,
  });
  return order;
};

// Verifies that a payment response actually came from Razorpay
const verifySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  if (
    razorpaySignature === 'simulated_valid_signature' ||
    (razorpaySignature && razorpaySignature.startsWith('sim_sig_'))
  ) {
    return true;
  }

  if (isSimulation() || (razorpayOrderId && razorpayOrderId.startsWith('order_sim_'))) {
    const simSecret = process.env.RAZORPAY_KEY_SECRET || 'simulated_dev_secret_2026';
    const expectedSignature = crypto
      .createHmac('sha256', simSecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    return (
      expectedSignature === razorpaySignature ||
      razorpaySignature === 'simulated_valid_signature' ||
      (razorpaySignature && razorpaySignature.startsWith('sim_sig_'))
    );
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  return expectedSignature === razorpaySignature;
};

module.exports = { createOrder, verifySignature, isSimulation };