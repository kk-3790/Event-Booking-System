const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

const API_BASE = 'http://localhost:5001/api';

async function runNotificationTests() {
  console.log('\n=============================================');
  console.log('🧪 TESTING MODEL 7: NOTIFICATION (Mongoose & Alerts)');
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
  const custEmail = `cust_notif_${testSuffix}@example.com`;
  const mobile = `41${String(testSuffix).slice(-8)}`;

  let custToken, custId;
  let createdNotifIds = [];

  try {
    // ---------------------------------------------------------
    // 1. UNIT TESTS ON NOTIFICATION MONGOOSE MODEL SCHEMA
    // ---------------------------------------------------------
    console.log('--- Phase 1: Mongoose Schema Validation ---');

    // 1.1 Required fields
    const emptyNotif = new Notification({});
    const validationErr = emptyNotif.validateSync();
    assert(validationErr, 'Validation error should be triggered for empty notification');
    assert(validationErr.errors.user, 'user is required');
    assert(validationErr.errors.type, 'type is required');
    assert(validationErr.errors.message, 'message is required');
    console.log('  ✅ [PASS] Required fields (user, type, message) strictly enforced');

    // 1.2 Default values
    const defaultNotif = new Notification({
      user: new mongoose.Types.ObjectId(),
      type: 'BOOKING_CONFIRMATION',
      message: 'Your ticket is booked!',
    });
    assert.strictEqual(defaultNotif.channel, 'EMAIL', 'Default channel must be EMAIL');
    assert.strictEqual(defaultNotif.status, 'PENDING', 'Default status must be PENDING');
    assert(defaultNotif.timestamp instanceof Date, 'timestamp must default to Date');
    console.log('  ✅ [PASS] Defaults validated (channel: EMAIL, status: PENDING, timestamp: Date)');

    // 1.3 Enum constraint checks
    defaultNotif.type = 'INVALID_TYPE';
    let enumErr = defaultNotif.validateSync();
    assert(enumErr && enumErr.errors.type, 'Should reject invalid notification type');

    defaultNotif.type = 'BOOKING_CONFIRMATION';
    defaultNotif.channel = 'CARRIER_PIGEON';
    enumErr = defaultNotif.validateSync();
    assert(enumErr && enumErr.errors.channel, 'Should reject invalid notification channel');
    console.log('  ✅ [PASS] Type and Channel enum constraints validated');

    // ---------------------------------------------------------
    // 2. ENDPOINT & CONTROLLER INTEGRATION TESTS
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Notification Dispatch & User Inbox ---');

    // Setup: Customer
    const custRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Notification Tester',
        email: custEmail,
        mobile,
        password: 'Password@123',
        role: 'CUSTOMER',
      }),
    });
    const custData = await custRes.json();
    custToken = custData.token;
    custId = custData.user.id;

    // Create 2 test notifications directly in DB
    const n1 = await Notification.create({
      user: custId,
      type: 'BOOKING_CONFIRMATION',
      message: 'Booking confirmed for Tech Summit 2026. Your QR pass is ready.',
      status: 'SENT',
    });
    const n2 = await Notification.create({
      user: custId,
      type: 'EVENT_REMINDER',
      message: 'Reminder: Tech Summit starts tomorrow at 09:00 AM!',
      status: 'SENT',
    });
    createdNotifIds.push(n1._id, n2._id);

    // Call GET /api/notifications/my
    console.log('  Testing: GET /api/notifications/my (Inbox fetch)...');
    const res = await fetch(`${API_BASE}/notifications/my`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert(Array.isArray(data), 'Returns array of notifications');
    assert(data.length >= 2, 'Should contain at least the 2 created notifications');
    assert.strictEqual(data[0]._id.toString(), n2._id.toString(), 'Should be sorted descending by createdAt');
    console.log('  ✅ [PASS] User inbox retrieved with chronological sorting');

    // ---------------------------------------------------------
    // 3. FRONTEND CONTRACT COMPATIBILITY
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Frontend Contract Compatibility ---');
    // Ensure properties needed by NotificationCenter.jsx are present:
    // _id, type, message, createdAt, status
    const item = data[0];
    assert(item._id && item.type && item.message && item.createdAt && item.status);
    console.log('  ✅ [PASS] Notification payload format 100% compliant with React NotificationCenter component');

    console.log('\n🎉 ALL NOTIFICATION MODEL & INBOX TESTS PASSED!\n');
  } finally {
    if (createdNotifIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotifIds } });
    }
    await User.deleteMany({ email: custEmail });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test notifications and users');
  }
}

runNotificationTests().catch((err) => {
  console.error('\n❌ NOTIFICATION TEST SUITE FAILED:', err);
  process.exit(1);
});
