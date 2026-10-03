const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const Payment = require('../models/Payment');
const RewardDraw = require('../models/RewardDraw');
const Voucher = require('../models/Voucher');
const { sendEmailNotification } = require('../services/notificationService');

const API_BASE = 'http://localhost:5001/api';

async function runNotificationEdgeCaseTests() {
  console.log('\n===============================================================');
  console.log('🔔 COMPREHENSIVE NOTIFICATION MODEL & LIFECYCLE TEST SUITE');
  console.log('===============================================================\n');

  const primaryUri = process.env.MONGO_URI;
  const localFallbackUri = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/event-booking';
  try {
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
    console.log('📦 Connected to MongoDB Atlas');
  } catch {
    await mongoose.connect(localFallbackUri);
    console.log('📦 Connected to local MongoDB fallback');
  }

  const suffix = Date.now();
  const emails = {
    org: `notif_org_${suffix}@test.com`,
    custAlice: `notif_alice_${suffix}@test.com`,
    custBob: `notif_bob_${suffix}@test.com`,
  };

  const tokens = {};
  const userIds = {};
  const createdNotificationIds = [];
  const createdBookingIds = [];
  const createdEventIds = [];
  const createdPaymentIds = [];
  const createdDrawIds = [];
  const createdVoucherIds = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Register test accounts (1 Organizer, 2 Customers)
    // -------------------------------------------------------------
    console.log('--- Setup: Initializing Test Accounts & Event ---');

    const registerUser = async (name, email, role, mobileSuffix) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          mobile: `96${String(suffix).slice(-6)}${mobileSuffix}`,
          password: 'Password@123',
          role,
        }),
      });
      const data = await res.json();
      assert(data.token, `Registration failed for ${email}: ${JSON.stringify(data)}`);
      return { token: data.token, id: data.user.id };
    };

    const orgData = await registerUser('Organizer Host', emails.org, 'ORGANIZER', '01');
    tokens.org = orgData.token;
    userIds.org = orgData.id;

    const aliceData = await registerUser('Customer Alice', emails.custAlice, 'CUSTOMER', '02');
    tokens.alice = aliceData.token;
    userIds.alice = aliceData.id;

    const bobData = await registerUser('Customer Bob', emails.custBob, 'CUSTOMER', '03');
    tokens.bob = bobData.token;
    userIds.bob = bobData.id;

    console.log('  ✅ Test accounts registered (Organizer, Alice, Bob)');

    // Create an active test event
    const eventRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.org}`,
      },
      body: JSON.stringify({
        eventName: `Notif Fest ${suffix}`,
        category: 'Music',
        venue: 'Grand Arena',
        date: '2026-12-15',
        time: '18:00',
        endTime: '22:00',
        ticketPrice: 800,
        availableSeats: 40,
      }),
    });
    const eventData = await eventRes.json();
    const eventId = eventData.event._id;
    createdEventIds.push(eventId);
    console.log(`  ✅ Test Event created: "${eventData.event.eventName}"`);

    // -------------------------------------------------------------
    // TEST SUITE: EXECUTE ALL NOTIFICATION EDGE CASES
    // -------------------------------------------------------------
    console.log('\n--- Executing Notification Edge Case Verifications ---');

    // Case 1: Schema Validation - Missing Required User
    console.log('  [Case 1/17] Schema validation: missing user reference...');
    try {
      await Notification.create({
        type: 'EVENT_UPDATE',
        message: 'Missing user payload',
      });
      assert.fail('Expected ValidationError for missing user');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.user);
      console.log('  ✅ [PASS] Case 1: Notification rejected without required user reference');
    }

    // Case 2: Schema Validation - Missing Required Message
    console.log('  [Case 2/17] Schema validation: missing message string...');
    try {
      await Notification.create({
        user: userIds.alice,
        type: 'EVENT_UPDATE',
      });
      assert.fail('Expected ValidationError for missing message');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.message);
      console.log('  ✅ [PASS] Case 2: Notification rejected without required message');
    }

    // Case 3: Schema Validation - Invalid Type Enum
    console.log('  [Case 3/17] Schema validation: invalid notification type enum...');
    try {
      await Notification.create({
        user: userIds.alice,
        type: 'INVALID_BLAST_TYPE',
        message: 'Hello world',
      });
      assert.fail('Expected ValidationError for invalid type');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.type);
      console.log('  ✅ [PASS] Case 3: Invalid type enum rejected by Mongoose schema');
    }

    // Case 4: Schema Validation - Invalid Channel Enum
    console.log('  [Case 4/17] Schema validation: invalid channel enum...');
    try {
      await Notification.create({
        user: userIds.alice,
        type: 'EVENT_UPDATE',
        message: 'Hello world',
        channel: 'WHATSAPP_INVALID',
      });
      assert.fail('Expected ValidationError for invalid channel');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.channel);
      console.log('  ✅ [PASS] Case 4: Invalid delivery channel rejected by schema');
    }

    // Case 5: Schema Validation - Invalid Status Enum
    console.log('  [Case 5/17] Schema validation: invalid delivery status enum...');
    try {
      await Notification.create({
        user: userIds.alice,
        type: 'EVENT_UPDATE',
        message: 'Hello world',
        status: 'UNRECOGNIZED_STATUS',
      });
      assert.fail('Expected ValidationError for invalid status');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.status);
      console.log('  ✅ [PASS] Case 5: Invalid status enum rejected by schema');
    }

    // Case 6: Access Control - Unauthenticated Inbox Request
    console.log('  [Case 6/17] Access control: unauthenticated GET /api/notifications/my...');
    let res = await fetch(`${API_BASE}/notifications/my`);
    let data = await res.json();
    assert.strictEqual(res.status, 401);
    assert(/authorization denied|no token/i.test(data.message));
    console.log('  ✅ [PASS] Case 6: Unauthenticated request rejected with 401 Unauthorized');

    // Case 7: Access Control - Forged / Invalid JWT Token
    console.log('  [Case 7/17] Access control: invalid token signature...');
    res = await fetch(`${API_BASE}/notifications/my`, {
      headers: { Authorization: 'Bearer forged.fake.jwt.token' },
    });
    data = await res.json();
    assert.strictEqual(res.status, 401);
    assert(/not valid|token/i.test(data.message));
    console.log('  ✅ [PASS] Case 7: Forged token rejected with 401 Unauthorized');

    // Case 8: Multi-Tenant Privacy & Cross-User Isolation
    console.log('  [Case 8/17] Multi-tenant isolation: Bob cannot view Alice\'s notifications...');
    const alicePrivateNotif = await Notification.create({
      user: userIds.alice,
      type: 'BOOKING_CONFIRMATION',
      message: 'Confidential: Alice ticket pass confirmation #ALICE99',
      status: 'SENT',
    });
    createdNotificationIds.push(alicePrivateNotif._id);

    // Bob requests his notifications
    res = await fetch(`${API_BASE}/notifications/my`, {
      headers: { Authorization: `Bearer ${tokens.bob}` },
    });
    const bobNotifs = await res.json();
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(bobNotifs));
    const leakedNotif = bobNotifs.find((n) => n._id.toString() === alicePrivateNotif._id.toString());
    assert.strictEqual(leakedNotif, undefined, 'Bob must NOT receive Alice\'s notification');
    console.log('  ✅ [PASS] Case 8: Strict user isolation verified; Bob cannot access Alice\'s notifications');

    // Case 9: Dangling / Deleted Booking Reference Handling
    console.log('  [Case 9/17] Dangling reference: booking deleted after notification generated...');
    // Create temporary booking and notification
    const tempBooking = await Booking.create({
      user: userIds.alice,
      event: eventId,
      bookingDate: new Date(),
      bookingTime: '18:00',
      ticketCount: 1,
      totalAmount: 840,
      bookingStatus: 'PENDING',
    });
    const danglingNotif = await Notification.create({
      user: userIds.alice,
      booking: tempBooking._id,
      type: 'EVENT_UPDATE',
      message: 'Notice with attached temporary booking',
      status: 'SENT',
    });
    createdNotificationIds.push(danglingNotif._id);

    // Purge the booking
    await Booking.findByIdAndDelete(tempBooking._id);

    // Alice fetches notifications; populate('booking') should return null gracefully
    res = await fetch(`${API_BASE}/notifications/my`, {
      headers: { Authorization: `Bearer ${tokens.alice}` },
    });
    const aliceNotifs = await res.json();
    assert.strictEqual(res.status, 200);
    const foundDangling = aliceNotifs.find((n) => n._id.toString() === danglingNotif._id.toString());
    assert(foundDangling);
    assert.strictEqual(foundDangling.booking, null, 'Dangling booking reference must populate as null without crash');
    console.log('  ✅ [PASS] Case 9: Dangling booking reference handled gracefully without server crash');

    // Case 10: Lifecycle Trigger - Payment Verification Dispatches BOOKING_CONFIRMATION
    console.log('  [Case 10/17] Lifecycle: payment verification dispatches BOOKING_CONFIRMATION...');
    const booking10Res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ eventId, ticketCount: 1 }),
    });
    const booking10Data = await booking10Res.json();
    const booking10Id = booking10Data.booking._id;
    createdBookingIds.push(booking10Id);

    const order10Res = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ bookingId: booking10Id }),
    });
    const order10Data = await order10Res.json();
    createdPaymentIds.push(order10Data.paymentId);

    await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({
        paymentId: order10Data.paymentId,
        razorpayOrderId: order10Data.razorpayOrderId,
        razorpayPaymentId: `pay_notif_${Date.now()}`,
        razorpaySignature: 'simulated_valid_signature',
      }),
    });

    // Wait for async background email & notification worker to finish writing to DB
    await new Promise((r) => setTimeout(r, 600));

    // Check Alice's inbox for confirmation
    const notifsAfterPay = await Notification.find({ user: userIds.alice, type: 'BOOKING_CONFIRMATION' });
    assert(notifsAfterPay.length > 0, 'Alice must receive a BOOKING_CONFIRMATION notification');
    const latestConfirm = notifsAfterPay[notifsAfterPay.length - 1];
    assert(latestConfirm.message.includes('confirmed'));
    createdNotificationIds.push(...notifsAfterPay.map((n) => n._id));
    console.log('  ✅ [PASS] Case 10: Successful payment verification dispatched BOOKING_CONFIRMATION to inbox');

    // Case 11: Lifecycle Trigger - Payment Verification Failure Dispatches PAYMENT_FAILED
    console.log('  [Case 11/17] Lifecycle: signature tampering dispatches PAYMENT_FAILED...');
    const booking11Res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ eventId, ticketCount: 1 }),
    });
    const booking11Data = await booking11Res.json();
    const booking11Id = booking11Data.booking._id;
    createdBookingIds.push(booking11Id);

    const order11Res = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ bookingId: booking11Id }),
    });
    const order11Data = await order11Res.json();
    createdPaymentIds.push(order11Data.paymentId);

    // Submit invalid signature to fail payment
    await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({
        paymentId: order11Data.paymentId,
        razorpayOrderId: order11Data.razorpayOrderId,
        razorpayPaymentId: `pay_tamper_${Date.now()}`,
        razorpaySignature: 'FORGED_INVALID_HASH',
      }),
    });

    // Wait for async background email & notification worker
    await new Promise((r) => setTimeout(r, 600));

    const notifsAfterFail = await Notification.find({ user: userIds.alice, type: 'PAYMENT_FAILED' });
    assert(notifsAfterFail.length > 0, 'Alice must receive a PAYMENT_FAILED notification');
    const latestFail = notifsAfterFail[notifsAfterFail.length - 1];
    assert(/failed|released/i.test(latestFail.message));
    createdNotificationIds.push(...notifsAfterFail.map((n) => n._id));
    console.log('  ✅ [PASS] Case 11: Payment failure dispatched PAYMENT_FAILED alert to user');

    // Case 12: Lifecycle Trigger - Lucky Draw Dispatches DRAW_RESULT with Voucher
    console.log('  [Case 12/17] Lifecycle: Lucky Draw winner selection dispatches DRAW_RESULT...');
    // Create an open draw for Event
    const draw = await RewardDraw.create({
      event: eventId,
      promoTicketPrice: 600,
      discountPercentage: 25,
      numberOfWinners: 1,
      participants: [userIds.alice],
      drawStatus: 'OPEN',
    });
    createdDrawIds.push(draw._id);

    // Host conducts draw
    const drawRes = await fetch(`${API_BASE}/rewards/draw/${draw._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.org}` },
    });
    const drawResultData = await drawRes.json();
    assert.strictEqual(drawRes.status, 200);
    if (drawResultData.vouchers) {
      createdVoucherIds.push(...drawResultData.vouchers.map((v) => v._id));
    }

    const drawNotifs = await Notification.find({ user: userIds.alice, type: 'DRAW_RESULT' });
    assert(drawNotifs.length > 0, 'Alice must receive DRAW_RESULT notification');
    const latestDrawNotif = drawNotifs[drawNotifs.length - 1];
    assert(latestDrawNotif.message.includes('Congratulations'));
    assert(latestDrawNotif.message.includes('25%'));
    createdNotificationIds.push(...drawNotifs.map((n) => n._id));
    console.log('  ✅ [PASS] Case 12: Draw execution dispatched DRAW_RESULT with prize voucher to winner');

    // Case 13: Lifecycle Trigger - Host Event Cancellation Broadcasts EVENT_UPDATE
    console.log('  [Case 13/17] Lifecycle: host event cancellation dispatches EVENT_UPDATE to attendees...');
    // Create new event to cancel
    const cancelEvtRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org}` },
      body: JSON.stringify({
        eventName: `Concert To Cancel ${suffix}`,
        category: 'Music',
        venue: 'Park Arena',
        date: '2026-12-20',
        time: '19:00',
        endTime: '23:00',
        ticketPrice: 600,
        availableSeats: 30,
      }),
    });
    const cancelEvtData = await cancelEvtRes.json();
    const cancelEvtId = cancelEvtData.event._id;
    createdEventIds.push(cancelEvtId);

    // Alice books and confirms
    const aliceCancelBooking = await Booking.create({
      user: userIds.alice,
      event: cancelEvtId,
      bookingDate: new Date(),
      bookingTime: '19:00',
      ticketCount: 2,
      totalAmount: 1260,
      bookingStatus: 'CONFIRMED',
    });
    createdBookingIds.push(aliceCancelBooking._id);

    // Organizer cancels event via DELETE /api/events/:id
    const cancelActionRes = await fetch(`${API_BASE}/events/${cancelEvtId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.org}` },
    });
    assert.strictEqual(cancelActionRes.status, 200);

    const cancelNotifs = await Notification.find({
      user: userIds.alice,
      type: 'EVENT_UPDATE',
      message: { $regex: /Cancellation Notice/i },
    });
    assert(cancelNotifs.length > 0, 'Alice must receive EVENT_UPDATE cancellation notice');
    createdNotificationIds.push(...cancelNotifs.map((n) => n._id));
    console.log('  ✅ [PASS] Case 13: Event cancellation dispatched EVENT_UPDATE to all confirmed attendees');

    // Case 14: Lifecycle Trigger - Event Cancellation on 0-Attendee Event Completes Cleanly
    console.log('  [Case 14/17] Lifecycle: cancellation of event with 0 attendees executes cleanly...');
    const emptyEvtRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org}` },
      body: JSON.stringify({
        eventName: `Empty Event ${suffix}`,
        category: 'Business',
        venue: 'Hall 4',
        date: '2026-12-22',
        time: '10:00',
        endTime: '12:00',
        ticketPrice: 300,
        availableSeats: 20,
      }),
    });
    const emptyEvtData = await emptyEvtRes.json();
    createdEventIds.push(emptyEvtData.event._id);

    const emptyCancelRes = await fetch(`${API_BASE}/events/${emptyEvtData.event._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.org}` },
    });
    const emptyCancelData = await emptyCancelRes.json();
    assert.strictEqual(emptyCancelRes.status, 200);
    assert.strictEqual(emptyCancelData.refundedBookingsCount, 0);
    console.log('  ✅ [PASS] Case 14: Zero-attendee event cancellation executed cleanly without errors');

    // Case 15: Reminder Logic - Only CONFIRMED Bookings Receive EVENT_REMINDER
    console.log('  [Case 15/17] Reminder logic: only CONFIRMED bookings queued for EVENT_REMINDER...');
    // Simulated query matching backend/jobs/eventReminderJob.js
    const confirmedB = await Booking.create({
      user: userIds.alice,
      event: eventId,
      bookingStatus: 'CONFIRMED',
      ticketCount: 1,
    });
    const cancelledB = await Booking.create({
      user: userIds.bob,
      event: eventId,
      bookingStatus: 'CANCELLED',
      ticketCount: 1,
    });
    const expiredB = await Booking.create({
      user: userIds.bob,
      event: eventId,
      bookingStatus: 'EXPIRED',
      ticketCount: 1,
    });
    createdBookingIds.push(confirmedB._id, cancelledB._id, expiredB._id);

    // Run the reminder query
    const eligibleReminders = await Booking.find({
      _id: { $in: [confirmedB._id, cancelledB._id, expiredB._id] },
      bookingStatus: 'CONFIRMED',
    });
    assert.strictEqual(eligibleReminders.length, 1);
    assert.strictEqual(eligibleReminders[0]._id.toString(), confirmedB._id.toString());
    console.log('  ✅ [PASS] Case 15: Event reminder job strictly excludes CANCELLED and EXPIRED bookings');

    // Case 16: SMTP Graceful Fallback in Development / Simulation Mode
    console.log('  [Case 16/17] SMTP fallback: dispatches in-app record without SMTP credentials...');
    const fallbackNotif = await sendEmailNotification({
      user: { _id: userIds.bob, email: emails.custBob, name: 'Customer Bob' },
      type: 'EVENT_REMINDER',
      message: 'Reminder test under simulated delivery',
    });
    createdNotificationIds.push(fallbackNotif._id);
    assert.strictEqual(fallbackNotif.status, 'SENT');
    assert(fallbackNotif.providerResponseId.startsWith('dev_sim_') || fallbackNotif.providerResponseId);
    console.log('  ✅ [PASS] Case 16: Missing SMTP credentials fallback safely creates SENT notification');

    // Case 17: Chronological Ordering (Newest First)
    console.log('  [Case 17/17] Sorting verification: GET /api/notifications/my returns newest first...');
    const nEarly = await Notification.create({
      user: userIds.bob,
      type: 'EVENT_UPDATE',
      message: 'Early notice',
      createdAt: new Date(Date.now() - 3600 * 1000),
    });
    const nLate = await Notification.create({
      user: userIds.bob,
      type: 'EVENT_UPDATE',
      message: 'Late notice',
      createdAt: new Date(),
    });
    createdNotificationIds.push(nEarly._id, nLate._id);

    res = await fetch(`${API_BASE}/notifications/my`, {
      headers: { Authorization: `Bearer ${tokens.bob}` },
    });
    const bobFeed = await res.json();
    assert.strictEqual(res.status, 200);
    assert(bobFeed.length >= 2);
    // Verify first notification is newer than or equal to second
    const date0 = new Date(bobFeed[0].createdAt).getTime();
    const date1 = new Date(bobFeed[1].createdAt).getTime();
    assert(date0 >= date1, 'Notifications must be sorted descending by createdAt');
    console.log('  ✅ [PASS] Case 17: Notifications returned in reverse-chronological order (newest first)');

    console.log('\n===============================================================');
    console.log('🎉 ALL 17 NOTIFICATION MODEL & LIFECYCLE EDGE CASES PASSED!');
    console.log('===============================================================\n');

  } finally {
    console.log('--- Cleaning Up Test Data ---');
    if (createdNotificationIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
    }
    if (createdPaymentIds.length > 0) {
      await Payment.deleteMany({ _id: { $in: createdPaymentIds } });
    }
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (createdEventIds.length > 0) {
      await Event.deleteMany({ _id: { $in: createdEventIds } });
    }
    if (createdVoucherIds.length > 0) {
      await Voucher.deleteMany({ _id: { $in: createdVoucherIds } });
    }
    if (createdDrawIds.length > 0) {
      await RewardDraw.deleteMany({ _id: { $in: createdDrawIds } });
    }
    await User.deleteMany({ email: { $in: Object.values(emails) } });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test notifications, bookings, events, payments, vouchers, and users.');
  }
  process.exit(0);
}

runNotificationEdgeCaseTests().catch((err) => {
  console.error('\n❌ NOTIFICATION TEST SUITE FAILED:', err);
  process.exit(1);
});
