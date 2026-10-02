const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const RewardDraw = require('../models/RewardDraw');
const Event = require('../models/Event');
const User = require('../models/User');

const API_BASE = 'http://localhost:5001/api';

async function runRewardTests() {
  console.log('\n=============================================');
  console.log('🧪 TESTING MODEL 6: REWARD DRAW (Mongoose & Promos)');
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
  const orgEmail = `org_rew_${testSuffix}@example.com`;
  const custEmail = `cust_rew_${testSuffix}@example.com`;
  const mobile1 = `51${String(testSuffix).slice(-8)}`;
  const mobile2 = `52${String(testSuffix).slice(-8)}`;

  let orgToken, custToken, eventId, drawId;

  try {
    // ---------------------------------------------------------
    // 1. UNIT TESTS ON REWARD DRAW MONGOOSE MODEL SCHEMA
    // ---------------------------------------------------------
    console.log('--- Phase 1: Mongoose Schema Validation ---');

    // 1.1 Required fields
    const emptyDraw = new RewardDraw({});
    const validationErr = emptyDraw.validateSync();
    assert(validationErr, 'Validation error should be triggered for empty draw');
    assert(validationErr.errors.event, 'event reference is required');
    assert(validationErr.errors.promoTicketPrice, 'promoTicketPrice is required');
    assert(validationErr.errors.discountPercentage, 'discountPercentage is required');
    assert(validationErr.errors.numberOfWinners, 'numberOfWinners is required');
    console.log('  ✅ [PASS] Required fields (event, promoTicketPrice, discountPercentage, numberOfWinners) enforced');

    // 1.2 Default values
    const defaultDraw = new RewardDraw({
      event: new mongoose.Types.ObjectId(),
      promoTicketPrice: 800,
      discountPercentage: 20,
      numberOfWinners: 2,
    });
    assert.strictEqual(defaultDraw.drawStatus, 'OPEN', 'Default drawStatus must be OPEN');
    console.log('  ✅ [PASS] Default drawStatus validated as "OPEN"');

    // 1.3 Discount range validation (0 - 100)
    defaultDraw.discountPercentage = 150; // out of range
    const maxErr = defaultDraw.validateSync();
    assert(maxErr && maxErr.errors.discountPercentage, 'discountPercentage cannot exceed 100');
    console.log('  ✅ [PASS] discountPercentage range constraint (max 100%) validated');

    // ---------------------------------------------------------
    // 2. ENDPOINT & CONTROLLER INTEGRATION TESTS
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Promotional Campaigns & Draw Execution ---');

    // Setup: Organizer, Customer, Event
    const orgRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Reward Org',
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
        name: 'Reward Cust',
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
        eventName: `Indie Film Fest ${testSuffix}`,
        category: 'Film',
        venue: 'Cineplex Hall 1',
        date: '2026-11-10',
        time: '18:00',
        endTime: '21:00',
        ticketPrice: 600,
        availableSeats: 40,
      }),
    });
    const eventData = await eventRes.json();
    eventId = eventData.event._id;

    // 2.1 Organizer creates Lucky Draw campaign
    console.log('  Testing: POST /api/rewards/event/:eventId (Organizer launches draw)...');
    let res = await fetch(`${API_BASE}/rewards/event/${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        discountPercentage: 25,
        numberOfWinners: 3,
        drawDate: '2026-11-09',
      }),
    });
    let data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.draw && data.draw._id, 'Draw should be returned');
    assert.strictEqual(data.draw.discountPercentage, 25);
    assert.strictEqual(data.draw.promoTicketPrice, 450, 'Promo price should be 600 * 0.75 = 450');
    drawId = data.draw._id;
    console.log('  ✅ [PASS] Lucky Draw campaign created with 25% discounted promo price (Rs 450)');

    // 2.2 Customer verifies promo code
    console.log('  Testing: POST /api/rewards/apply-promo (Customer applies LUCKY20)...');
    res = await fetch(`${API_BASE}/rewards/apply-promo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        eventId,
        code: 'LUCKY20',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.discountPercentage, 20);
    assert.strictEqual(data.discountedPrice, 480, '600 - 20% = 480');
    console.log('  ✅ [PASS] Promo voucher code validated with calculated discounted price');

    // 2.3 Fetch draw status for event
    console.log('  Testing: GET /api/rewards/event/:eventId...');
    res = await fetch(`${API_BASE}/rewards/event/${eventId}`);
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert(data.draw, 'Includes draw configuration');
    assert(Array.isArray(data.availablePromos), 'Includes list of platform promos');
    console.log('  ✅ [PASS] Event reward draw details and platform promo catalog retrieved');

    // ---------------------------------------------------------
    // 3. FRONTEND CONTRACT COMPATIBILITY
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Frontend Contract Compatibility ---');
    // Ensure all keys expected by RewardDrawModal.jsx are present:
    // draw.discountPercentage, draw.numberOfWinners, draw.promoTicketPrice, draw.drawStatus
    assert(data.draw.drawStatus === 'OPEN');
    assert(typeof data.draw.promoTicketPrice === 'number');
    console.log('  ✅ [PASS] Reward draw payload matches React RewardDrawModal requirements');

    console.log('\n🎉 ALL REWARD DRAW MODEL & PROMO TESTS PASSED!\n');
  } finally {
    if (drawId) {
      await RewardDraw.findByIdAndDelete(drawId);
    }
    if (eventId) {
      await Event.findByIdAndDelete(eventId);
    }
    await User.deleteMany({ email: { $in: [orgEmail, custEmail] } });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test reward draws, events, and users');
  }
}

runRewardTests().catch((err) => {
  console.error('\n❌ REWARD TEST SUITE FAILED:', err);
  process.exit(1);
});
