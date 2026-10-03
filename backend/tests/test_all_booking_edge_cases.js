const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const Voucher = require('../models/Voucher');
const RewardDraw = require('../models/RewardDraw');
const Payment = require('../models/Payment');

const API_BASE = 'http://localhost:5001/api';

async function runEdgeCaseTests() {
  console.log('\n===============================================================');
  console.log('🧪 COMPREHENSIVE BOOKING MODEL & EDGE CASES TEST SUITE');
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
    org1: `org1_edge_${suffix}@test.com`,
    org2: `org2_edge_${suffix}@test.com`,
    cust1: `cust1_edge_${suffix}@test.com`,
    admin: `admin_edge_${suffix}@test.com`,
  };

  const tokens = {};
  const userIds = {};
  const createdBookingIds = [];
  const createdEventIds = [];
  const createdVoucherIds = [];
  const createdDrawIds = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Register test accounts (2 Organizers, 1 Customer, 1 Admin)
    // -------------------------------------------------------------
    console.log('--- Setup: Initializing Test Accounts ---');

    const registerUser = async (name, email, role, mobileSuffix) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          mobile: `98${String(suffix).slice(-6)}${mobileSuffix}`,
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

    const cust1Data = await registerUser('Customer One', emails.cust1, 'CUSTOMER', '03');
    tokens.cust1 = cust1Data.token;
    userIds.cust1 = cust1Data.id;

    const adminData = await registerUser('Super Admin', emails.admin, 'ADMIN', '04');
    tokens.admin = adminData.token;
    userIds.admin = adminData.id;

    console.log('  ✅ Accounts initialized (Organizer Alpha, Organizer Beta, Customer One, Super Admin)');

    // Create Test Events
    // Event A: Multi-tier active event hosted by Org 1
    const eventARes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.org1}`,
      },
      body: JSON.stringify({
        eventName: `Tech Summit Alpha ${suffix}`,
        category: 'Technology',
        venue: 'Grand Hall A',
        date: '2026-12-01',
        time: '10:00',
        endTime: '18:00',
        ticketTiers: [
          { tierName: 'VIP Pass', price: 2000, totalSeats: 5, availableSeats: 5 },
          { tierName: 'Standard', price: 500, totalSeats: 20, availableSeats: 20 },
        ],
      }),
    });
    const eventAData = await eventARes.json();
    const eventAId = eventAData.event._id;
    createdEventIds.push(eventAId);

    // Event B: Active event hosted by Org 2 (for cross-organizer tests)
    const eventBRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.org2}`,
      },
      body: JSON.stringify({
        eventName: `Music Carnival Beta ${suffix}`,
        category: 'Music',
        venue: 'Open Arena B',
        date: '2026-12-05',
        time: '16:00',
        endTime: '22:00',
        ticketPrice: 800,
        availableSeats: 30,
      }),
    });
    const eventBData = await eventBRes.json();
    const eventBId = eventBData.event._id;
    createdEventIds.push(eventBId);

    // Event C: Cancelled event hosted by Org 1
    const eventCRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.org1}`,
      },
      body: JSON.stringify({
        eventName: `Cancelled Workshop ${suffix}`,
        category: 'Workshop',
        venue: 'Room C',
        date: '2026-12-10',
        time: '14:00',
        endTime: '17:00',
        ticketPrice: 300,
        availableSeats: 15,
      }),
    });
    const eventCData = await eventCRes.json();
    const eventCId = eventCData.event._id;
    createdEventIds.push(eventCId);
    await Event.findByIdAndUpdate(eventCId, { status: 'CANCELLED' });

    // Event D: Concluded event in the past hosted by Org 1
    const eventD = await Event.create({
      organizer: userIds.org1,
      eventName: `Concluded Gala ${suffix}`,
      category: 'Networking',
      venue: 'Past Venue D',
      date: '2025-01-01',
      time: '10:00',
      endTime: '12:00',
      ticketPrice: 400,
      totalSeats: 10,
      availableSeats: 10,
      status: 'COMPLETED',
    });
    const eventDId = eventD._id;
    createdEventIds.push(eventDId);

    console.log('  ✅ Events initialized (Event A: Multi-tier, Event B: Org 2, Event C: Cancelled, Event D: Concluded)');

    // -------------------------------------------------------------
    // TEST SUITE: EXECUTE ALL 18 EDGE CASES
    // -------------------------------------------------------------
    console.log('\n--- Executing Edge Case Verifications ---');

    // Edge Case 1: Overselling / Sold-Out Event
    console.log('  [Case 1/18] Overselling beyond event available seats...');
    let res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventBId, ticketCount: 50 }),
    });
    let data = await res.json();
    assert.strictEqual(res.status, 409, `Expected 409 Conflict, got ${res.status}`);
    console.log('  ✅ [PASS] Case 1: Overselling blocked with 409 Conflict');

    // Edge Case 2: Tier-Specific Overselling
    console.log('  [Case 2/18] Tier capacity exhaustion (booking 10 when VIP only has 5)...');
    res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, ticketCount: 10, tierName: 'VIP Pass' }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 409);
    assert(data.message.includes('Not enough seats in tier "VIP Pass"'));
    console.log('  ✅ [PASS] Case 2: Tier capacity exhaustion blocked with 409 Conflict');

    // Edge Case 3: Invalid Ticket Quantity (0 or negative)
    console.log('  [Case 3/18] Invalid ticket quantity (ticketCount: 0)...');
    res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, ticketCount: 0 }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(data.message.includes('valid ticketCount are required'));
    console.log('  ✅ [PASS] Case 3: Zero/negative ticket count rejected with 400 Bad Request');

    // Edge Case 4: Booking on Concluded / Past Event
    console.log('  [Case 4/18] Booking on already concluded/past event...');
    res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventDId, ticketCount: 1 }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/already ended/i.test(data.message));
    console.log('  ✅ [PASS] Case 4: Booking on concluded event rejected with 400 Bad Request');

    // Edge Case 5: Booking on Cancelled Event
    console.log('  [Case 5/18] Booking on cancelled event...');
    res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventCId, ticketCount: 1 }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/cancelled/i.test(data.message));
    console.log('  ✅ [PASS] Case 5: Booking on cancelled event rejected with 400 Bad Request');

    // Edge Case 6: Cross-Organizer Voucher Abuse
    console.log('  [Case 6/18] Cross-organizer voucher abuse...');
    // Create a winner voucher issued by Org 1 for Customer 1
    const voucherOrg1 = await Voucher.create({
      code: `WIN-ORG1-${suffix.toString().slice(-4)}`,
      user: userIds.cust1,
      organizer: userIds.org1,
      sourceEvent: eventAId,
      discountPercentage: 20,
      isRedeemed: false,
    });
    createdVoucherIds.push(voucherOrg1._id);

    // Try applying Org 1's voucher to Org 2's Event B
    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventBId, code: voucherOrg1.code }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(data.message.includes('exclusively valid for events hosted by'));
    console.log('  ✅ [PASS] Case 6: Cross-organizer voucher redemption rejected with 400 Bad Request');

    // Edge Case 7: Double-Redemption of Winner Voucher
    console.log('  [Case 7/18] Double redemption of already redeemed voucher...');
    voucherOrg1.isRedeemed = true;
    await voucherOrg1.save();
    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, code: voucherOrg1.code }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/invalid or expired/i.test(data.message));
    console.log('  ✅ [PASS] Case 7: Already-redeemed voucher rejected with 400 Bad Request');

    // Edge Case 8: Expired Winner Voucher
    console.log('  [Case 8/18] Expired winner voucher rejection...');
    const expiredVoucher = await Voucher.create({
      code: `WIN-EXP-${suffix.toString().slice(-4)}`,
      user: userIds.cust1,
      organizer: userIds.org1,
      sourceEvent: eventAId,
      discountPercentage: 20,
      isRedeemed: false,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
    });
    createdVoucherIds.push(expiredVoucher._id);
    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, code: expiredVoucher.code }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/expired/i.test(data.message));
    console.log('  ✅ [PASS] Case 8: Expired voucher rejected with 400 Bad Request');

    // Edge Case 9: Lucky Draw Contest Entry Without Instant Discount
    console.log('  [Case 9/18] Lucky Draw enrollment with 0 instant discount...');
    const draw = await RewardDraw.create({
      event: eventAId,
      discountPercentage: 25,
      promoTicketPrice: 1500,
      numberOfWinners: 2,
      drawStatus: 'OPEN',
    });
    createdDrawIds.push(draw._id);

    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, code: 'LUCKYDRAW' }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.discountPercentage, 0, 'Instant discount on current pass must be 0%');
    assert.strictEqual(data.isContestEntry, true);
    assert.strictEqual(data.nextBookingDiscount, 25);

    // Book with LUCKYDRAW and verify unit price equals base price
    res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({
        eventId: eventAId,
        ticketCount: 1,
        tierName: 'Standard',
        promoCode: 'LUCKYDRAW',
        isPromotional: true,
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.booking.unitPrice, 500, 'Unit price must be full regular price 500');
    assert.strictEqual(data.booking.isPromotional, true);
    createdBookingIds.push(data.booking._id);
    console.log('  ✅ [PASS] Case 9: LUCKYDRAW enrolls attendee in draw with 0% current discount');

    // Edge Case 10: 10-Minute Hold Auto-Release & Expiration
    console.log('  [Case 10/18] 10-minute seat hold auto-release on expired booking...');
    const holdRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({
        eventId: eventBId,
        ticketCount: 4,
      }),
    });
    const holdData = await holdRes.json();
    const holdBookingId = holdData.booking._id;
    createdBookingIds.push(holdBookingId);

    // Simulate 10-minute expiration by setting expiresAt to the past
    await Booking.findByIdAndUpdate(holdBookingId, { expiresAt: new Date(Date.now() - 60 * 1000) });

    // Customer visits /api/bookings/my which triggers expireIfNeeded
    res = await fetch(`${API_BASE}/bookings/my`, {
      headers: { Authorization: `Bearer ${tokens.cust1}` },
    });
    const myBookings = await res.json();
    const expiredBooking = myBookings.find((b) => b._id.toString() === holdBookingId.toString());
    assert.strictEqual(expiredBooking.bookingStatus, 'EXPIRED', 'Status must transition to EXPIRED');

    // Verify seats were released back to Event B
    const updatedEventB = await Event.findById(eventBId);
    assert.strictEqual(updatedEventB.availableSeats, 30, 'Seats must be restored to 30');
    console.log('  ✅ [PASS] Case 10: Expired booking releases held seats back to event');

    // Edge Case 11: Customer Self-Cancellation Block
    console.log('  [Case 11/18] Customer self-cancellation restriction...');
    res = await fetch(`${API_BASE}/bookings/${holdBookingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.cust1}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    assert(/Customer self-cancellation is disabled/i.test(data.message));
    console.log('  ✅ [PASS] Case 11: Customer self-cancellation blocked with 403 Forbidden');

    // Edge Case 12 & 13: Admin Cancellation & Inventory Re-crediting
    console.log('  [Case 12 & 13/18] Admin cancellation and inventory restoration...');
    // Create a confirmed booking to cancel
    const cancelTestRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, ticketCount: 2, tierName: 'VIP Pass' }),
    });
    const cancelTestData = await cancelTestRes.json();
    const cancelBookingId = cancelTestData.booking._id;
    createdBookingIds.push(cancelBookingId);

    // Mark confirmed
    await Booking.findByIdAndUpdate(cancelBookingId, { bookingStatus: 'CONFIRMED' });

    // Admin cancels the booking
    res = await fetch(`${API_BASE}/bookings/${cancelBookingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.booking.bookingStatus, 'CANCELLED');

    // Check double cancellation block
    res = await fetch(`${API_BASE}/bookings/${cancelBookingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/already cancelled/i.test(data.message));
    console.log('  ✅ [PASS] Case 12 & 13: Admin cancellation succeeds & double-cancellation blocked with 400');

    // Edge Case 14: Gate Check-In First Valid Scan
    console.log('  [Case 14/18] Gate check-in first valid scan...');
    const validBookingRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, ticketCount: 1, tierName: 'Standard' }),
    });
    const validBookingData = await validBookingRes.json();
    const validBookingId = validBookingData.booking._id;
    createdBookingIds.push(validBookingId);

    // Confirm booking
    await Booking.findByIdAndUpdate(validBookingId, { bookingStatus: 'CONFIRMED' });

    res = await fetch(`${API_BASE}/bookings/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org1}` },
      body: JSON.stringify({ qrData: validBookingId, eventId: eventAId }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.booking.checkedIn, true);
    console.log('  ✅ [PASS] Case 14: Valid gate check-in confirmed with 200 OK');

    // Edge Case 15: Duplicate Gate Scan Rejection
    console.log('  [Case 15/18] Duplicate gate scan rejection (anti-pass-sharing)...');
    res = await fetch(`${API_BASE}/bookings/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org1}` },
      body: JSON.stringify({ qrData: validBookingId, eventId: eventAId }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 409, `Expected 409 Conflict for duplicate scan, got ${res.status}`);
    assert(/Already Checked In/i.test(data.message));
    console.log('  ✅ [PASS] Case 15: Duplicate gate scan rejected with 409 Conflict');

    // Edge Case 16: Check-In with Unpaid Ticket
    console.log('  [Case 16/18] Check-in with unconfirmed/pending ticket...');
    const pendingBookingRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cust1}` },
      body: JSON.stringify({ eventId: eventAId, ticketCount: 1, tierName: 'Standard' }),
    });
    const pendingBookingData = await pendingBookingRes.json();
    const pendingBookingId = pendingBookingData.booking._id;
    createdBookingIds.push(pendingBookingId);

    res = await fetch(`${API_BASE}/bookings/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org1}` },
      body: JSON.stringify({ qrData: pendingBookingId, eventId: eventAId }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(/Only CONFIRMED tickets can enter/i.test(data.message));
    console.log('  ✅ [PASS] Case 16: Unpaid/pending ticket check-in rejected with 400 Bad Request');

    // Edge Case 17: Unauthorized Scanner (Wrong Organizer)
    console.log('  [Case 17/18] Unauthorized scanner (Organizer Beta scanning Organizer Alpha ticket)...');
    res = await fetch(`${API_BASE}/bookings/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org2}` },
      body: JSON.stringify({ qrData: validBookingId, eventId: eventAId }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 403);
    assert(/not the organizer for this event/i.test(data.message));
    console.log('  ✅ [PASS] Case 17: Cross-organizer gate scanning rejected with 403 Forbidden');

    // Edge Case 18: Invalid / Fake Ticket Code
    console.log('  [Case 18/18] Non-existent / fake ticket pass code...');
    res = await fetch(`${API_BASE}/bookings/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.org1}` },
      body: JSON.stringify({ qrData: 'FAKE-INVALID-TICKET-CODE', eventId: eventAId }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 404);
    assert(/Ticket pass not found/i.test(data.message));
    console.log('  ✅ [PASS] Case 18: Fake ticket code rejected with 404 Not Found');

    console.log('\n===============================================================');
    console.log('🎉 ALL 18 BOOKING MODEL & WORKFLOW EDGE CASES PASSED SUCCESSFULLY!');
    console.log('===============================================================\n');

  } finally {
    console.log('--- Cleaning Up Test Data ---');
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
    console.log('🧹 Cleaned up temporary test bookings, events, vouchers, draws, and users.');
  }
}

runEdgeCaseTests().catch((err) => {
  console.error('\n❌ EDGE CASE TEST FAILED:', err);
  process.exit(1);
});
