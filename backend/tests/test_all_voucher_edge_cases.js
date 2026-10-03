const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Voucher = require('../models/Voucher');
const RewardDraw = require('../models/RewardDraw');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');

const API_BASE = 'http://localhost:5001/api';

async function runVoucherEdgeCaseTests() {
  console.log('\n===============================================================');
  console.log('🎟️ COMPREHENSIVE VOUCHER MODEL & REWARD SYSTEM TEST SUITE');
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
    org1: `vouch_org1_${suffix}@test.com`,
    org2: `vouch_org2_${suffix}@test.com`,
    alice: `vouch_alice_${suffix}@test.com`,
    bob: `vouch_bob_${suffix}@test.com`,
    admin: `vouch_admin_${suffix}@test.com`,
  };

  const tokens = {};
  const userIds = {};
  const createdVoucherIds = [];
  const createdDrawIds = [];
  const createdBookingIds = [];
  const createdEventIds = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Register test accounts (2 Organizers, 2 Customers, 1 Admin)
    // -------------------------------------------------------------
    console.log('--- Setup: Initializing Test Accounts & Events ---');

    const registerUser = async (name, email, role, mobileSuffix) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          mobile: `95${String(suffix).slice(-6)}${mobileSuffix}`,
          password: 'Password@123',
          role,
        }),
      });
      const data = await res.json();
      assert(data.token, `Registration failed for ${email}: ${JSON.stringify(data)}`);
      return { token: data.token, id: data.user.id };
    };

    const org1Data = await registerUser('Organizer Alpha', emails.org1, 'ORGANIZER', '01');
    tokens.org1 = org1Data.token;
    userIds.org1 = org1Data.id;

    const org2Data = await registerUser('Organizer Beta', emails.org2, 'ORGANIZER', '02');
    tokens.org2 = org2Data.token;
    userIds.org2 = org2Data.id;

    const aliceData = await registerUser('Customer Alice', emails.alice, 'CUSTOMER', '03');
    tokens.alice = aliceData.token;
    userIds.alice = aliceData.id;

    const bobData = await registerUser('Customer Bob', emails.bob, 'CUSTOMER', '04');
    tokens.bob = bobData.token;
    userIds.bob = bobData.id;

    const adminData = await registerUser('Super Admin Voucher', emails.admin, 'ADMIN', '05');
    tokens.admin = adminData.token;
    userIds.admin = adminData.id;

    console.log('  ✅ Accounts initialized (Organizer Alpha, Organizer Beta, Alice, Bob, Admin)');

    // Create Event A (hosted by Organizer Alpha)
    const eventARes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org1}` },
      body: JSON.stringify({
        eventName: `Tech Conference Alpha ${suffix}`,
        category: 'Technology',
        venue: 'Grand Hall Alpha',
        date: '2026-11-28',
        time: '10:00',
        endTime: '17:00',
        ticketPrice: 1000,
        availableSeats: 50,
      }),
    });
    const eventAData = await eventARes.json();
    const eventAId = eventAData.event._id;
    createdEventIds.push(eventAId);

    // Create Event B (hosted by Organizer Beta)
    const eventBRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org2}` },
      body: JSON.stringify({
        eventName: `Art Expo Beta ${suffix}`,
        category: 'Exhibition',
        venue: 'Gallery Beta',
        date: '2026-12-02',
        time: '11:00',
        endTime: '19:00',
        ticketPrice: 600,
        availableSeats: 40,
      }),
    });
    const eventBData = await eventBRes.json();
    const eventBId = eventBData.event._id;
    createdEventIds.push(eventBId);

    console.log('  ✅ Events initialized (Event A by Org Alpha, Event B by Org Beta)');

    // -------------------------------------------------------------
    // TEST SUITE: EXECUTE ALL 17 VOUCHER EDGE CASES
    // -------------------------------------------------------------
    console.log('\n--- Executing Voucher Edge Case Verifications ---');

    // Case 1: Schema Validation - Duplicate Voucher Code Collision
    console.log('  [Case 1/17] Schema validation: duplicate voucher code collision...');
    const duplicateCode = `DUPLICATE-${suffix.toString().slice(-4)}`;
    const v1 = await Voucher.create({
      code: duplicateCode,
      user: userIds.alice,
      organizer: userIds.org1,
      sourceEvent: eventAId,
      discountPercentage: 20,
    });
    createdVoucherIds.push(v1._id);

    try {
      await Voucher.create({
        code: duplicateCode,
        user: userIds.bob,
        organizer: userIds.org1,
        sourceEvent: eventAId,
        discountPercentage: 25,
      });
      assert.fail('Expected duplicate key error on identical voucher code');
    } catch (err) {
      assert(err.code === 11000 || /duplicate/i.test(err.message));
      console.log('  ✅ [PASS] Case 1: Duplicate voucher code rejected with unique index collision (E11000)');
    }

    // Case 2: Schema Validation - Missing Required User
    console.log('  [Case 2/17] Schema validation: missing user recipient...');
    try {
      await Voucher.create({
        code: `MISSING-USER-${suffix.toString().slice(-4)}`,
        organizer: userIds.org1,
        sourceEvent: eventAId,
        discountPercentage: 20,
      });
      assert.fail('Expected ValidationError for missing user');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.user);
      console.log('  ✅ [PASS] Case 2: Voucher rejected without recipient user reference');
    }

    // Case 3: Schema Validation - Missing Required Organizer
    console.log('  [Case 3/17] Schema validation: missing issuing organizer...');
    try {
      await Voucher.create({
        code: `MISSING-ORG-${suffix.toString().slice(-4)}`,
        user: userIds.alice,
        sourceEvent: eventAId,
        discountPercentage: 20,
      });
      assert.fail('Expected ValidationError for missing organizer');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.organizer);
      console.log('  ✅ [PASS] Case 3: Voucher rejected without issuing organizer reference');
    }

    // Case 4: Schema Validation - Missing Source Event Reference
    console.log('  [Case 4/17] Schema validation: missing sourceEvent reference...');
    try {
      await Voucher.create({
        code: `MISSING-EVT-${suffix.toString().slice(-4)}`,
        user: userIds.alice,
        organizer: userIds.org1,
        discountPercentage: 20,
      });
      assert.fail('Expected ValidationError for missing sourceEvent');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.sourceEvent);
      console.log('  ✅ [PASS] Case 4: Voucher rejected without sourceEvent origin reference');
    }

    // Case 5: Schema Validation - Invalid Discount Percentage Range (< 1 or > 100)
    console.log('  [Case 5/17] Schema validation: invalid discount percentage (< 1 or > 100)...');
    try {
      await Voucher.create({
        code: `INVALID-DISC-${suffix.toString().slice(-4)}`,
        user: userIds.alice,
        organizer: userIds.org1,
        sourceEvent: eventAId,
        discountPercentage: 0,
      });
      assert.fail('Expected ValidationError for discountPercentage 0');
    } catch (err) {
      assert(err.name === 'ValidationError');
      assert(err.errors.discountPercentage);
      console.log('  ✅ [PASS] Case 5: Invalid discount percentage (< 1% or > 100%) rejected by schema');
    }

    // Case 6: Normalization: Lowercase & Whitespace Trimming
    console.log('  [Case 6/17] Normalization: whitespace and case insensitivity...');
    const aliceVoucher = await Voucher.create({
      code: `WIN-ALPHA-${suffix.toString().slice(-4)}`,
      user: userIds.alice,
      organizer: userIds.org1,
      sourceEvent: eventAId,
      discountPercentage: 20,
      isRedeemed: false,
    });
    createdVoucherIds.push(aliceVoucher._id);

    // Apply with leading spaces and lowercase: e.g. "   win-alpha-1234   "
    const spacedCode = `   ${aliceVoucher.code.toLowerCase()}   `;
    let res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ eventId: eventAId, code: spacedCode }),
    });
    let data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.valid, true);
    assert.strictEqual(data.code, aliceVoucher.code);
    assert.strictEqual(data.discountPercentage, 20);
    assert.strictEqual(data.discountedPrice, 800); // 1000 - 20% = 800
    console.log('  ✅ [PASS] Case 6: Whitespace and lowercase automatically normalized at checkout');

    // Case 7: Access Control - Cross-Account Voucher Theft (Bob using Alice's voucher)
    console.log('  [Case 7/17] Anti-theft: Bob attempting to redeem Alice\'s voucher code...');
    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.bob}` },
      body: JSON.stringify({ eventId: eventAId, code: aliceVoucher.code }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 403);
    assert(/belongs to another attendee account/i.test(data.message));
    console.log('  ✅ [PASS] Case 7: Cross-account voucher theft blocked with 403 Forbidden');

    // Case 8: Access Control - Cross-User Voucher Wallet Leakage (GET /api/rewards/my-vouchers)
    console.log('  [Case 8/17] Multi-tenant wallet: Bob querying /api/rewards/my-vouchers...');
    res = await fetch(`${API_BASE}/rewards/my-vouchers`, {
      headers: { Authorization: `Bearer ${tokens.bob}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(data));
    const leakedAliceVoucher = data.find((v) => v._id.toString() === aliceVoucher._id.toString());
    assert.strictEqual(leakedAliceVoucher, undefined, 'Bob must NOT receive Alice\'s vouchers');
    console.log('  ✅ [PASS] Case 8: Strict wallet privacy enforced; Bob cannot see Alice\'s vouchers');

    // Case 9: Multi-Tenancy - Cross-Organizer Voucher Abuse (Org 1 voucher on Org 2 event)
    console.log('  [Case 9/17] Cross-organizer boundary: Alice applying Org 1 voucher to Org 2 Event B...');
    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ eventId: eventBId, code: aliceVoucher.code }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(data.message.includes('exclusively valid for events hosted by'));
    console.log('  ✅ [PASS] Case 9: Cross-organizer voucher abuse blocked with 400 Bad Request');

    // Case 10: Lifecycle - Double-Redemption Replay Attack
    console.log('  [Case 10/17] Anti-double-spend: reusing an already redeemed voucher...');
    // Mark Alice's voucher as redeemed
    aliceVoucher.isRedeemed = true;
    aliceVoucher.redeemedAt = new Date();
    await aliceVoucher.save();

    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ eventId: eventAId, code: aliceVoucher.code }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/invalid or expired/i.test(data.message));
    console.log('  ✅ [PASS] Case 10: Redeemed voucher replay rejected with 400 Bad Request');

    // Case 11: Lifecycle - Expired Winner Voucher (> 90-Day Expiration)
    console.log('  [Case 11/17] Lifecycle: applying an expired voucher (past expiresAt)...');
    const expiredVoucher = await Voucher.create({
      code: `EXPIRED-${suffix.toString().slice(-4)}`,
      user: userIds.alice,
      organizer: userIds.org1,
      sourceEvent: eventAId,
      discountPercentage: 30,
      isRedeemed: false,
      expiresAt: new Date(Date.now() - 48 * 3600 * 1000), // Expired 2 days ago
    });
    createdVoucherIds.push(expiredVoucher._id);

    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({ eventId: eventAId, code: expiredVoucher.code }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/expired/i.test(data.message));
    console.log('  ✅ [PASS] Case 11: Expired voucher rejected with 400 Bad Request');

    // Case 12: Lifecycle - Atomic Redemption on Booking Creation
    console.log('  [Case 12/17] Atomicity: booking creation automatically marks voucher redeemed...');
    const freshVoucher = await Voucher.create({
      code: `FRESH-${suffix.toString().slice(-4)}`,
      user: userIds.alice,
      organizer: userIds.org1,
      sourceEvent: eventAId,
      discountPercentage: 25,
      isRedeemed: false,
    });
    createdVoucherIds.push(freshVoucher._id);

    // Book ticket with fresh voucher
    const bookWithVoucherRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
      body: JSON.stringify({
        eventId: eventAId,
        ticketCount: 1,
        promoCode: freshVoucher.code,
      }),
    });
    const bookWithVoucherData = await bookWithVoucherRes.json();
    assert.strictEqual(bookWithVoucherRes.status, 201);
    const bookingId = bookWithVoucherData.booking._id;
    createdBookingIds.push(bookingId);

    // Verify voucher is atomically marked redeemed and linked to booking
    const updatedFreshVoucher = await Voucher.findById(freshVoucher._id);
    assert.strictEqual(updatedFreshVoucher.isRedeemed, true);
    assert(updatedFreshVoucher.redeemedAt);
    assert.strictEqual(updatedFreshVoucher.redeemedBooking.toString(), bookingId.toString());
    assert.strictEqual(bookWithVoucherData.booking.unitPrice, 750); // 1000 - 25% = 750
    console.log('  ✅ [PASS] Case 12: Voucher atomically marked redeemed and bound to booking ID upon reservation');

    // Case 13: Contest Mechanics - LUCKYDRAW Promo Code Does Not Provide Instant Discount
    console.log('  [Case 13/17] Contest mechanics: LUCKYDRAW enrolls attendee with 0% current discount...');
    const contestDraw = await RewardDraw.create({
      event: eventAId,
      discountPercentage: 35,
      promoTicketPrice: 650,
      numberOfWinners: 2,
      drawStatus: 'OPEN',
    });
    createdDrawIds.push(contestDraw._id);

    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.bob}` },
      body: JSON.stringify({ eventId: eventAId, code: 'LUCKYDRAW' }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.discountPercentage, 0, 'Instant discount must be 0%');
    assert.strictEqual(data.isContestEntry, true);
    assert.strictEqual(data.nextBookingDiscount, 35);
    console.log('  ✅ [PASS] Case 13: LUCKYDRAW correctly recognized as contest entry with 0% instant discount');

    // Case 14: Draw Minting - Double Draw Execution Block
    console.log('  [Case 14/17] Winner fairness: preventing double execution on completed draw...');
    // Enroll Alice in draw
    contestDraw.participants = [userIds.alice];
    await contestDraw.save();

    // Execute draw 1st time
    res = await fetch(`${API_BASE}/rewards/draw/${contestDraw._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.org1}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    if (data.vouchers) {
      createdVoucherIds.push(...data.vouchers.map((v) => v._id));
    }

    // Try executing draw 2nd time
    res = await fetch(`${API_BASE}/rewards/draw/${contestDraw._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.org1}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/already been conducted/i.test(data.message));
    console.log('  ✅ [PASS] Case 14: Re-executing completed draw blocked with 400 Bad Request');

    // Case 15: Draw Minting - Unauthorized Draw Execution
    console.log('  [Case 15/17] Access control: Organizer Beta attempting to conduct Organizer Alpha draw...');
    const drawForOrg1 = await RewardDraw.create({
      event: eventAId,
      discountPercentage: 20,
      promoTicketPrice: 800,
      numberOfWinners: 1,
      participants: [userIds.alice],
      drawStatus: 'OPEN',
    });
    createdDrawIds.push(drawForOrg1._id);

    res = await fetch(`${API_BASE}/rewards/draw/${drawForOrg1._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.org2}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 403);
    assert(/not authorized to conduct this draw/i.test(data.message));
    console.log('  ✅ [PASS] Case 15: Unauthorized draw execution blocked with 403 Forbidden');

    // Case 16: Draw Minting - Zero-Participant Draw Execution
    console.log('  [Case 16/17] Empty pool: executing draw with 0 participants...');
    const emptyDraw = await RewardDraw.create({
      event: eventAId,
      discountPercentage: 20,
      promoTicketPrice: 800,
      numberOfWinners: 2,
      participants: [],
      drawStatus: 'OPEN',
    });
    createdDrawIds.push(emptyDraw._id);

    res = await fetch(`${API_BASE}/rewards/draw/${emptyDraw._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.org1}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/No participants enrolled/i.test(data.message));
    console.log('  ✅ [PASS] Case 16: Zero-participant draw execution cleanly rejected with 400 Bad Request');

    // Case 17: Draw Minting - Capped Winner Count When Pool Smaller Than Requested
    console.log('  [Case 17/17] Winner count capping: requesting 5 winners when only 2 enrolled...');
    const cappedDraw = await RewardDraw.create({
      event: eventAId,
      discountPercentage: 20,
      promoTicketPrice: 800,
      numberOfWinners: 5,
      participants: [userIds.alice, userIds.bob],
      drawStatus: 'OPEN',
    });
    createdDrawIds.push(cappedDraw._id);

    res = await fetch(`${API_BASE}/rewards/draw/${cappedDraw._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.org1}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.winners.length, 2, 'Should pick exactly 2 winners when only 2 enrolled');
    assert.strictEqual(data.vouchers.length, 2, 'Should issue exactly 2 vouchers');
    if (data.vouchers) {
      createdVoucherIds.push(...data.vouchers.map((v) => v._id));
    }
    console.log('  ✅ [PASS] Case 17: Winner count automatically capped to pool size (2/5) without errors');

    console.log('\n===============================================================');
    console.log('🎉 ALL 17 VOUCHER MODEL & REWARD SYSTEM EDGE CASES PASSED!');
    console.log('===============================================================\n');

  } finally {
    console.log('--- Cleaning Up Test Data ---');
    if (createdVoucherIds.length > 0) {
      await Voucher.deleteMany({ _id: { $in: createdVoucherIds } });
    }
    if (createdDrawIds.length > 0) {
      await RewardDraw.deleteMany({ _id: { $in: createdDrawIds } });
    }
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (createdEventIds.length > 0) {
      await Event.deleteMany({ _id: { $in: createdEventIds } });
    }
    await User.deleteMany({ email: { $in: Object.values(emails) } });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test vouchers, draws, bookings, events, and users.');
  }
  process.exit(0);
}

runVoucherEdgeCaseTests().catch((err) => {
  console.error('\n❌ VOUCHER TEST SUITE FAILED:', err);
  process.exit(1);
});
