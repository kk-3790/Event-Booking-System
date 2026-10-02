const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');

const API_BASE = 'http://localhost:5001/api';

async function runBookingTests() {
  console.log('\n==========================================');
  console.log('🧪 TESTING MODEL 3: BOOKING (Mongoose & Gate Check-In)');
  console.log('==========================================\n');

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
  const orgEmail = `org_bkg_${testSuffix}@example.com`;
  const custEmail = `cust_bkg_${testSuffix}@example.com`;
  const mobile1 = `81${String(testSuffix).slice(-8)}`;
  const mobile2 = `82${String(testSuffix).slice(-8)}`;

  let orgToken, custToken, orgId, custId;
  let eventId = null;
  let createdBookingIds = [];

  try {
    // ---------------------------------------------------------
    // SETUP: Create Organizer, Customer, and Multi-Tier Event
    // ---------------------------------------------------------
    const orgRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ticket Gate Organizer',
        email: orgEmail,
        mobile: mobile1,
        password: 'Password@123',
        role: 'ORGANIZER',
      }),
    });
    const orgData = await orgRes.json();
    orgToken = orgData.token;
    orgId = orgData.user.id;

    const custRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pass Attendee',
        email: custEmail,
        mobile: mobile2,
        password: 'Password@123',
        role: 'CUSTOMER',
      }),
    });
    const custData = await custRes.json();
    custToken = custData.token;
    custId = custData.user.id;

    const eventRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        eventName: `Rock Festival ${testSuffix}`,
        category: 'Concert',
        venue: 'Starlight Stadium',
        date: '2026-11-25',
        time: '18:00',
        endTime: '23:00',
        ticketTiers: [
          { tierName: 'Front Stage VIP', price: 2500, totalSeats: 10, availableSeats: 10, perks: 'VIP Gate + Drinks' },
          { tierName: 'General Lawn', price: 750, totalSeats: 50, availableSeats: 50, perks: 'Open Grass Access' },
        ],
      }),
    });
    const eventData = await eventRes.json();
    eventId = eventData.event._id;

    // ---------------------------------------------------------
    // 1. UNIT TESTS ON BOOKING MONGOOSE MODEL SCHEMA
    // ---------------------------------------------------------
    console.log('--- Phase 1: Mongoose Schema Validation ---');

    // 1.1 Required fields
    const emptyBooking = new Booking({});
    const validationErr = emptyBooking.validateSync();
    assert(validationErr, 'Validation error should be triggered for empty booking');
    assert(validationErr.errors.user, 'user is required');
    assert(validationErr.errors.event, 'event is required');
    assert(validationErr.errors.ticketCount, 'ticketCount is required');
    console.log('  ✅ [PASS] Required fields (user, event, ticketCount) strictly enforced');

    // 1.2 Default values
    const defaultBooking = new Booking({
      user: new mongoose.Types.ObjectId(),
      event: new mongoose.Types.ObjectId(),
      ticketCount: 2,
    });
    assert.strictEqual(defaultBooking.bookingStatus, 'PENDING');
    assert.strictEqual(defaultBooking.checkedIn, false);
    assert.strictEqual(defaultBooking.tierName, 'General Admission');
    console.log('  ✅ [PASS] Defaults validated (status: PENDING, checkedIn: false)');

    // 1.3 Ticket count min validation
    defaultBooking.ticketCount = 0;
    const minErr = defaultBooking.validateSync();
    assert(minErr && minErr.errors.ticketCount, 'ticketCount must be at least 1');
    console.log('  ✅ [PASS] ticketCount >= 1 constraint validated');

    // ---------------------------------------------------------
    // 2. CONTROLLER & API INTEGRATION TESTS
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Booking Flow & Atomic Inventory ---');

    // 2.1 Customer books VIP tickets
    console.log('  Testing: POST /api/bookings (VIP tier booking)...');
    let res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        eventId,
        ticketCount: 2,
        tierName: 'Front Stage VIP',
      }),
    });
    let data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.booking && data.booking._id, 'Booking object returned');
    const vipBookingId = data.booking._id;
    createdBookingIds.push(vipBookingId);

    assert.strictEqual(data.booking.ticketCount, 2);
    assert.strictEqual(data.booking.tierName, 'Front Stage VIP');
    assert.strictEqual(data.booking.unitPrice, 2500);
    assert.strictEqual(data.booking.subtotal, 5000);
    assert.strictEqual(data.booking.totalAmount, 5250, 'Total should include 5% platform fee (250)');
    assert(data.booking.expiresAt, 'Should include 10-minute hold expiresAt');
    assert(data.booking.qrCode, 'Should include auto-generated QR code');
    assert(data.booking.qrCode.startsWith('data:image/png;base64,'), 'QR code should be valid PNG data URL');
    console.log('  ✅ [PASS] VIP booking created with 10m seat hold and scannable QR Code Data URL');

    // 2.2 Verify atomic seat inventory decrement
    console.log('  Testing: Verifying atomic inventory decrement in Event...');
    res = await fetch(`${API_BASE}/events/${eventId}`);
    data = await res.json();
    const updatedVipTier = data.ticketTiers.find((t) => t.tierName === 'Front Stage VIP');
    assert.strictEqual(updatedVipTier.availableSeats, 8, 'VIP tier seats should decrease from 10 to 8');
    assert.strictEqual(data.availableSeats, 58, 'Total event seats should decrease from 60 to 58');
    console.log('  ✅ [PASS] Event tier seats and total availableSeats atomically decremented');

    // 2.3 Attempt to book more seats than available -> 409 Conflict
    console.log('  Testing: Seat exhaustion protection (booking 15 when only 8 remain)...');
    res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        eventId,
        ticketCount: 15,
        tierName: 'Front Stage VIP',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 409, `Expected 409 Conflict for overselling, got ${res.status}`);
    console.log('  ✅ [PASS] Overselling prevented with 409 Conflict');

    // 2.4 Customer retrieves their bookings
    console.log('  Testing: GET /api/bookings/my (Attendee Wallet)...');
    res = await fetch(`${API_BASE}/bookings/my`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(data), 'Returns array of user bookings');
    const myVipBooking = data.find((b) => b._id.toString() === vipBookingId.toString());
    assert(myVipBooking, 'Contains the created VIP booking');
    assert(myVipBooking.qrCode, 'Contains QR Code');
    console.log('  ✅ [PASS] User booking history retrieved with populated event and QR pass');

    // ---------------------------------------------------------
    // 3. GATE ADMISSION & ANTI-FRAUD CHECK-IN TESTS
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Gate Admission & Anti-Fraud Scan ---');

    // Confirm booking to simulate successful payment
    await Booking.findByIdAndUpdate(vipBookingId, { bookingStatus: 'CONFIRMED' });

    // 3.1 First scan at entry gate -> Success
    console.log('  Testing: POST /api/bookings/check-in (First valid scan)...');
    res = await fetch(`${API_BASE}/bookings/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        qrData: vipBookingId,
        eventId,
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200 OK for admission, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.booking.checkedIn, true, 'Booking should be checked in');
    assert(data.booking.checkedInAt, 'Should record check-in timestamp');
    console.log('  ✅ [PASS] Attendee successfully checked in at gate with 200 OK');

    // 3.2 Second scan (Duplicate / Fraud attempt) -> 409 Conflict
    console.log('  Testing: POST /api/bookings/check-in (Duplicate scan rejection)...');
    res = await fetch(`${API_BASE}/bookings/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        qrData: vipBookingId,
        eventId,
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 409, `Expected 409 Conflict for duplicate scan, got ${res.status}`);
    assert(/already checked in/i.test(data.message), 'Error message must state ticket already checked in');
    console.log('  ✅ [PASS] Anti-fraud protection rejected duplicate scan with 409 Conflict');

    // 3.3 Organizer views attendee metrics
    console.log('  Testing: GET /api/bookings/event/:eventId (Organizer turnout dashboard)...');
    res = await fetch(`${API_BASE}/bookings/event/${eventId}`, {
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.stats.confirmedBookings, 1);
    assert.strictEqual(data.stats.checkedInBookings, 1);
    assert.strictEqual(data.stats.totalCheckedInSeats, 2);
    console.log('  ✅ [PASS] Live turnout stats match check-in status (1 checked in booking, 2 seats)');

    console.log('\n🎉 ALL BOOKING MODEL & GATE CHECK-IN TESTS PASSED!\n');
  } finally {
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (eventId) {
      await Event.findByIdAndDelete(eventId);
    }
    await User.deleteMany({ email: { $in: [orgEmail, custEmail] } });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test bookings, events, and users');
  }
}

runBookingTests().catch((err) => {
  console.error('\n❌ BOOKING TEST SUITE FAILED:', err);
  process.exit(1);
});
