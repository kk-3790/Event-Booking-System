const assert = require('node:assert');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Receipt = require('../models/Receipt');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');

const API_BASE = 'http://localhost:5001/api';

async function runReceiptTests() {
  console.log('\n=============================================');
  console.log('🧪 TESTING MODEL 5: RECEIPT (Mongoose & Tax Invoice)');
  console.log('=============================================\n');

  const primaryUri = process.env.MONGO_URI;
  const localFallbackUri = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/event-booking';
  try {
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
    console.log('📦 Connected to MongoDB Atlas for model testing');
  } catch {
    await mongoose.connect(localFallbackUri);
    console.log('📦 Connected to local MongoDB fallback for model testing');
  }

  const testSuffix = Date.now();
  const orgEmail = `org_rec_${testSuffix}@example.com`;
  const custEmail = `cust_rec_${testSuffix}@example.com`;
  const mobile1 = `61${String(testSuffix).slice(-8)}`;
  const mobile2 = `62${String(testSuffix).slice(-8)}`;

  let orgToken, custToken, eventId, bookingId, paymentId;

  try {
    // ---------------------------------------------------------
    // 1. UNIT TESTS ON RECEIPT MONGOOSE MODEL SCHEMA
    // ---------------------------------------------------------
    console.log('--- Phase 1: Mongoose Schema Validation ---');

    // 1.1 Required fields
    const emptyReceipt = new Receipt({});
    const validationErr = emptyReceipt.validateSync();
    assert(validationErr, 'Validation error should be triggered for empty receipt');
    assert(validationErr.errors.payment, 'payment reference is required');
    assert(validationErr.errors.amount, 'amount is required');
    console.log('  ✅ [PASS] Required fields (payment, amount) strictly enforced');

    // 1.2 Default values
    const defaultReceipt = new Receipt({
      payment: new mongoose.Types.ObjectId(),
      amount: 1500,
    });
    assert(defaultReceipt.generatedDate instanceof Date, 'generatedDate should default to current Date');
    console.log('  ✅ [PASS] Default generatedDate initialized to Date instance');

    // ---------------------------------------------------------
    // 2. ENDPOINT & CONTROLLER INTEGRATION TESTS
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Payment Receipt Generation & Retrieval ---');

    // Setup: User, Org, Event, Booking, Payment
    const orgRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Receipt Org',
        email: orgEmail,
        mobile: mobile1,
        password: 'Password@123',
        role: 'ORGANIZER',
      }),
    });
    const orgData = await orgRes.json();
    orgToken = orgData.token;

    const custRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Receipt Cust',
        email: custEmail,
        mobile: mobile2,
        password: 'Password@123',
        role: 'CUSTOMER',
      }),
    });
    const custData = await custRes.json();
    custToken = custData.token;

    const eventRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        eventName: `Jazz & Blues Night ${testSuffix}`,
        category: 'Concert',
        venue: 'Blue Note Lounge',
        date: '2026-12-20',
        time: '20:00',
        endTime: '23:30',
        ticketPrice: 1200,
        availableSeats: 30,
      }),
    });
    const eventData = await eventRes.json();
    eventId = eventData.event._id;

    // Create booking (1 ticket: 1200 + 5% fee = 1260)
    const bkgRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({ eventId, ticketCount: 1 }),
    });
    const bkgData = await bkgRes.json();
    bookingId = bkgData.booking._id;

    // Create order
    const orderRes = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({ bookingId }),
    });
    const orderData = await orderRes.json();
    const orderId = orderData.razorpayOrderId;
    const internalPaymentId = orderData.paymentId;
    const rzpPayId = `pay_receipt_${testSuffix}`;

    // Verify payment with authentic signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${rzpPayId}`)
      .digest('hex');

    const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        paymentId: internalPaymentId,
        razorpayOrderId: orderId,
        razorpayPaymentId: rzpPayId,
        razorpaySignature: signature,
        paymentMethod: 'UPI',
      }),
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert(verifyData.receipt && verifyData.receipt._id, 'Receipt should be generated in verify response');
    const createdReceiptId = verifyData.receipt._id;

    // 2.1 Fetch receipt by booking ID (Used by MyBookings.jsx ReceiptModal)
    console.log('  Testing: GET /api/payments/booking/:bookingId...');
    const fetchRes = await fetch(`${API_BASE}/payments/booking/${bookingId}`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const fetchData = await fetchRes.json();
    assert.strictEqual(fetchRes.status, 200, `Expected 200 OK, got ${fetchRes.status}`);
    assert(fetchData.payment, 'Should include payment object');
    assert(fetchData.receipt, 'Should include receipt object');
    assert.strictEqual(fetchData.receipt._id.toString(), createdReceiptId.toString());
    assert.strictEqual(fetchData.receipt.amount, 1260, 'Receipt amount must match total amount paid');
    assert.strictEqual(fetchData.payment.transactionId, rzpPayId);
    console.log('  ✅ [PASS] Receipt successfully retrieved by booking ID with matching payment details');

    // ---------------------------------------------------------
    // 3. FRONTEND CONTRACT COMPATIBILITY
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Frontend Contract Compatibility ---');
    // Ensure all keys expected by ReceiptModal.jsx exist:
    // receipt._id, receipt.amount, receipt.generatedDate, payment.transactionId, payment.paymentMethod, booking.event
    assert(fetchData.receipt.generatedDate, 'Receipt contains generatedDate');
    assert(fetchData.payment.paymentMethod, 'Payment contains paymentMethod');
    assert(fetchData.payment.booking.event, 'Booking contains populated event');
    assert(fetchData.payment.booking.event.eventName, 'Event contains eventName');
    console.log('  ✅ [PASS] Receipt payload structure 100% matches React ReceiptModal requirements');

    console.log('\n🎉 ALL RECEIPT MODEL & TAX INVOICE TESTS PASSED!\n');
  } finally {
    if (bookingId) {
      const pDoc = await Payment.findOne({ booking: bookingId });
      if (pDoc) {
        await Receipt.deleteMany({ payment: pDoc._id });
        await Payment.findByIdAndDelete(pDoc._id);
      }
      await Booking.findByIdAndDelete(bookingId);
    }
    if (eventId) {
      await Event.findByIdAndDelete(eventId);
    }
    await User.deleteMany({ email: { $in: [orgEmail, custEmail] } });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test receipts, payments, and users');
  }
}

runReceiptTests().catch((err) => {
  console.error('\n❌ RECEIPT TEST SUITE FAILED:', err);
  process.exit(1);
});
