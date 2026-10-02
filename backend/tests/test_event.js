const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');

const API_BASE = 'http://localhost:5001/api';

async function runEventTests() {
  console.log('\n========================================');
  console.log('🧪 TESTING MODEL 2: EVENT (Mongoose & APIs)');
  console.log('========================================\n');

  const primaryUri = process.env.MONGO_URI;
  const localFallbackUri = 'mongodb://127.0.0.1:27017/event-booking';
  try {
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
    console.log('📦 Connected to MongoDB for model testing');
  } catch {
    await mongoose.connect(localFallbackUri);
    console.log('📦 Connected to local MongoDB fallback for model testing');
  }

  const testSuffix = Date.now();
  const orgEmail = `test_org_evt_${testSuffix}@example.com`;
  const customerEmail = `test_cust_evt_${testSuffix}@example.com`;
  const testMobile1 = `91${String(testSuffix).slice(-8)}`;
  const testMobile2 = `92${String(testSuffix).slice(-8)}`;

  let orgToken = null;
  let customerToken = null;
  let orgUserId = null;
  let createdEventIds = [];

  try {
    // ---------------------------------------------------------
    // SETUP: Register Organizer and Customer for API Tests
    // ---------------------------------------------------------
    const orgRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Event Organizer',
        email: orgEmail,
        mobile: testMobile1,
        password: 'Password@123',
        role: 'ORGANIZER',
      }),
    });
    const orgData = await orgRes.json();
    orgToken = orgData.token;
    orgUserId = orgData.user.id;

    const custRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Event Customer',
        email: customerEmail,
        mobile: testMobile2,
        password: 'Password@123',
        role: 'CUSTOMER',
      }),
    });
    const custData = await custRes.json();
    customerToken = custData.token;

    // ---------------------------------------------------------
    // 1. UNIT TESTS ON EVENT MONGOOSE MODEL SCHEMA
    // ---------------------------------------------------------
    console.log('--- Phase 1: Mongoose Schema Validation ---');

    // 1.1 Required fields validation
    const emptyEvent = new Event({});
    const validationErr = emptyEvent.validateSync();
    assert(validationErr, 'Validation error should occur for empty event');
    assert(validationErr.errors.eventName, 'eventName is required');
    assert(validationErr.errors.category, 'category is required');
    assert(validationErr.errors.venue, 'venue is required');
    assert(validationErr.errors.date, 'date is required');
    assert(validationErr.errors.time, 'time is required');
    assert(validationErr.errors.endTime, 'endTime is required');
    assert(validationErr.errors.ticketPrice, 'ticketPrice is required');
    assert(validationErr.errors.availableSeats, 'availableSeats is required');
    assert(validationErr.errors.organizer, 'organizer ObjectId is required');
    console.log('  ✅ [PASS] Required event fields strictly enforced');

    // 1.2 Default status is ACTIVE
    const defaultEvent = new Event({
      eventName: `Test Default Event ${testSuffix}`,
      category: 'Conference',
      venue: 'Auditorium A',
      date: new Date(),
      time: '10:00',
      endTime: '12:00',
      ticketPrice: 500,
      availableSeats: 100,
      organizer: new mongoose.Types.ObjectId(),
    });
    assert.strictEqual(defaultEvent.status, 'ACTIVE', 'Default status must be ACTIVE');
    console.log('  ✅ [PASS] Default status is "ACTIVE"');

    // 1.3 Status enum constraint
    defaultEvent.status = 'FLYING';
    const statusErr = defaultEvent.validateSync();
    assert(statusErr && statusErr.errors.status, 'Should reject invalid status');
    console.log('  ✅ [PASS] Status enum constraint validates against ["ACTIVE", "ONGOING", "CANCELLED", "COMPLETED"]');

    // 1.4 Ticket tiers schema validation
    defaultEvent.status = 'ACTIVE';
    defaultEvent.ticketTiers = [
      {
        tierName: 'VIP Pass',
        price: 1500,
        totalSeats: 20,
        availableSeats: 20,
        perks: 'Front row + Lounge access',
      },
      {
        tierName: 'General Admission',
        price: 500,
        totalSeats: 80,
        availableSeats: 80,
      },
    ];
    const tiersErr = defaultEvent.validateSync();
    assert(!tiersErr, 'Valid tiers should pass validation without error');
    console.log('  ✅ [PASS] Multi-tier subdocument structure validated successfully');

    // ---------------------------------------------------------
    // 2. ENDPOINT & CONTROLLER INTEGRATION TESTS (via HTTP API)
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Event Endpoints & API Integration ---');

    // 2.1 Customer trying to create event -> 403 Forbidden
    console.log('  Testing: Customer role rejected from creating event...');
    let res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        eventName: `Unauthorized Event ${testSuffix}`,
        category: 'Music',
        venue: 'Grand Arena',
        date: '2026-11-20',
        time: '18:00',
        endTime: '21:00',
        ticketPrice: 999,
        availableSeats: 50,
      }),
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden for non-organizer, got ${res.status}`);
    console.log('  ✅ [PASS] Role guard rejects unauthorized CUSTOMER with 403 Forbidden');

    // 2.2 Reject invalid time window (endTime <= time)
    console.log('  Testing: endTime <= time validation...');
    res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        eventName: `Invalid Time Event ${testSuffix}`,
        category: 'Music',
        venue: 'Grand Arena',
        date: '2026-11-20',
        time: '20:00',
        endTime: '19:00', // invalid: before start time
        ticketPrice: 999,
        availableSeats: 50,
      }),
    });
    let data = await res.json();
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
    assert(/endTime must be after time/i.test(data.message), 'Error should mention endTime validation');
    console.log('  ✅ [PASS] Invalid event duration rejected (endTime must be after time)');

    // 2.3 Organizer creates event with multi-tier pricing
    const validEventName = `Tech Summit ${testSuffix}`;
    console.log('  Testing: Organizer creates multi-tier event...');
    res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        eventName: validEventName,
        category: 'Technology',
        venue: 'Silicon Hall, Metro Complex',
        date: '2026-12-15',
        time: '09:00',
        endTime: '17:00',
        description: 'Annual cutting-edge tech conference with industry leaders.',
        ticketTiers: [
          { tierName: 'VIP', price: 2000, totalSeats: 25, availableSeats: 25, perks: 'VIP Lounge & Dinner' },
          { tierName: 'General', price: 800, totalSeats: 100, availableSeats: 100, perks: 'Standard Seating' },
          { tierName: 'Student', price: 400, totalSeats: 50, availableSeats: 50, perks: 'Valid Student ID Required' },
        ],
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.event && data.event._id, 'Event object should be created');
    createdEventIds.push(data.event._id);

    // Verify auto-aggregated totals
    assert.strictEqual(data.event.totalSeats, 175, 'totalSeats should sum across all tiers (25 + 100 + 50)');
    assert.strictEqual(data.event.availableSeats, 175, 'availableSeats should sum across all tiers');
    assert.strictEqual(data.event.ticketPrice, 400, 'base ticketPrice should be the minimum tier price');
    assert.strictEqual(data.event.ticketTiers.length, 3, 'All 3 tiers should be preserved');
    console.log('  ✅ [PASS] Multi-tier event created with aggregated seat counts and minimum base price');

    // 2.4 Duplicate event name rejection
    console.log('  Testing: Duplicate event name rejection (409 Conflict)...');
    res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        eventName: validEventName, // duplicate
        category: 'Other',
        venue: 'Another Venue',
        date: '2026-12-15',
        time: '10:00',
        endTime: '12:00',
        ticketPrice: 500,
        availableSeats: 50,
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 409, `Expected 409 Conflict for duplicate event name, got ${res.status}`);
    console.log('  ✅ [PASS] Duplicate event name rejected with 409 Conflict');

    // 2.5 Public fetch events list & keyword search
    console.log('  Testing: GET /api/events with search filter...');
    res = await fetch(`${API_BASE}/events?search=Tech+Summit`);
    data = await res.json();
    assert.strictEqual(res.status, 200);
    const eventList = data.events || data;
    assert(Array.isArray(eventList), 'Should return list of events');
    const matched = eventList.find((e) => e.eventName === validEventName);
    assert(matched, 'Search results should include the created test event');
    console.log('  ✅ [PASS] Public event catalog search returned matching event');

    // 2.6 Fetch event by ID
    console.log('  Testing: GET /api/events/:id...');
    res = await fetch(`${API_BASE}/events/${createdEventIds[0]}`);
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.eventName, validEventName);
    assert(data.organizer, 'Organizer should be populated');
    console.log('  ✅ [PASS] Single event details retrieved with populated organizer');

    // 2.7 Update event details
    console.log('  Testing: PUT /api/events/:id (Organizer updates description)...');
    res = await fetch(`${API_BASE}/events/${createdEventIds[0]}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        description: 'Updated conference description with confirmed keynotes.',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.event.description, 'Updated conference description with confirmed keynotes.');
    console.log('  ✅ [PASS] Event update successfully applied by authorized organizer');

    // ---------------------------------------------------------
    // 3. FRONTEND CONTRACT COMPATIBILITY
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Frontend Contract Compatibility ---');
    // Ensure all keys expected by EventList.jsx and EventDetails.jsx exist:
    const requiredFrontendProps = [
      '_id',
      'eventName',
      'category',
      'venue',
      'date',
      'time',
      'endTime',
      'ticketPrice',
      'availableSeats',
      'totalSeats',
      'ticketTiers',
      'status',
    ];
    for (const prop of requiredFrontendProps) {
      assert(data.event[prop] !== undefined, `Event response missing property "${prop}" required by Frontend`);
    }
    console.log('  ✅ [PASS] Event payload format 100% compliant with React EventList & EventDetails components');

    console.log('\n🎉 ALL EVENT MODEL & ENDPOINT INTEGRATION TESTS PASSED!\n');
  } finally {
    if (createdEventIds.length > 0) {
      await Event.deleteMany({ _id: { $in: createdEventIds } });
    }
    await User.deleteMany({ email: { $in: [orgEmail, customerEmail] } });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test events and users');
  }
}

runEventTests().catch((err) => {
  console.error('\n❌ EVENT TEST SUITE FAILED:', err);
  process.exit(1);
});
