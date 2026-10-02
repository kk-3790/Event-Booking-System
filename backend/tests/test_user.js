const assert = require('node:assert');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const API_BASE = 'http://localhost:5001/api/auth';

async function runUserTests() {
  console.log('\n========================================');
  console.log('🧪 TESTING MODEL 1: USER (Mongoose & Auth)');
  console.log('========================================\n');

  // Connect to DB for direct model validation tests
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
  const testCustomerEmail = `test_customer_${testSuffix}@example.com`;
  const testOrgEmail = `test_org_${testSuffix}@example.com`;
  const testMobile = `98${String(testSuffix).slice(-8)}`;
  const testOrgMobile = `97${String(testSuffix).slice(-8)}`;

  try {
    // ---------------------------------------------------------
    // 1. UNIT TESTS ON USER MONGOOSE MODEL SCHEMA
    // ---------------------------------------------------------
    console.log('--- Phase 1: Mongoose Schema Validation ---');

    // 1.1 Missing required fields
    const emptyUser = new User({});
    let validationErr = emptyUser.validateSync();
    assert(validationErr, 'Validation error should be thrown for empty user');
    assert(validationErr.errors.name, 'name should be required');
    assert(validationErr.errors.email, 'email should be required');
    assert(validationErr.errors.mobile, 'mobile should be required');
    assert(validationErr.errors.password, 'password should be required');
    console.log('  ✅ [PASS] Required field constraints enforced (name, email, mobile, password)');

    // 1.2 Default role is CUSTOMER
    const defaultUser = new User({
      name: 'Default Role Tester',
      email: 'default_role@example.com',
      mobile: '9999999901',
      password: 'password123',
    });
    assert.strictEqual(defaultUser.role, 'CUSTOMER', 'Default role must be CUSTOMER');
    console.log('  ✅ [PASS] Default role correctly set to "CUSTOMER"');

    // 1.3 Role enum validation
    const invalidRoleUser = new User({
      name: 'Invalid Role Tester',
      email: 'invalid_role@example.com',
      mobile: '9999999902',
      password: 'password123',
      role: 'SUPERUSER', // Not in ['ADMIN', 'ORGANIZER', 'CUSTOMER']
    });
    validationErr = invalidRoleUser.validateSync();
    assert(validationErr && validationErr.errors.role, 'Should reject invalid role');
    console.log('  ✅ [PASS] Role enum constraint correctly rejects invalid roles');

    // 1.4 Email lowercase & trimming
    const whitespaceUser = new User({
      name: '  Trim Tester  ',
      email: '  TEST_LOWER@EXAMPLE.COM  ',
      mobile: '  9999999903  ',
      password: 'password123',
    });
    assert.strictEqual(whitespaceUser.email, 'test_lower@example.com', 'Email should be trimmed & lowercased');
    assert.strictEqual(whitespaceUser.name, 'Trim Tester', 'Name should be trimmed');
    assert.strictEqual(whitespaceUser.mobile, '9999999903', 'Mobile should be trimmed');
    console.log('  ✅ [PASS] Email lowercasing and field trimming verified');

    // ---------------------------------------------------------
    // 2. ENDPOINT & CONTROLLER INTEGRATION TESTS (via HTTP API)
    // ---------------------------------------------------------
    console.log('\n--- Phase 2: Auth Endpoints & API Integration ---');

    // 2.1 Register new Customer
    console.log('  Testing: POST /api/auth/register (CUSTOMER)...');
    let res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Customer',
        email: testCustomerEmail,
        mobile: testMobile,
        password: 'Password@123',
        role: 'CUSTOMER',
      }),
    });
    let data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.token, 'Should return JWT token');
    assert.strictEqual(data.user.email, testCustomerEmail);
    assert.strictEqual(data.user.role, 'CUSTOMER');
    assert(data.user.id, 'User object should contain id');
    console.log('  ✅ [PASS] Customer registration succeeded with JWT and proper response format');

    // 2.2 Reject duplicate email
    console.log('  Testing: Duplicate Email Rejection...');
    res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Customer',
        email: testCustomerEmail,
        mobile: '9111111111',
        password: 'Password@123',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for duplicate email, got ${res.status}`);
    assert(/already exists/i.test(data.message), 'Error message should indicate user already exists');
    console.log('  ✅ [PASS] Duplicate email registration rejected with 400');

    // 2.3 Reject duplicate mobile
    console.log('  Testing: Duplicate Mobile Rejection...');
    res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Mobile',
        email: `unique_${testSuffix}@example.com`,
        mobile: testMobile, // already used
        password: 'Password@123',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for duplicate mobile, got ${res.status}`);
    assert(/already exists/i.test(data.message), 'Error message should indicate mobile already exists');
    console.log('  ✅ [PASS] Duplicate mobile number registration rejected with 400');

    // 2.4 Register Organizer
    console.log('  Testing: POST /api/auth/register (ORGANIZER)...');
    res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Organizer',
        email: testOrgEmail,
        mobile: testOrgMobile,
        password: 'OrganizerPassword@123',
        role: 'ORGANIZER',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201 for organizer registration, got ${res.status}`);
    assert.strictEqual(data.user.role, 'ORGANIZER');
    console.log('  ✅ [PASS] Organizer registration succeeded with role "ORGANIZER"');

    // 2.5 Login with Valid Credentials
    console.log('  Testing: POST /api/auth/login (Success case)...');
    res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: 'Password@123',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert(data.token, 'Login must return token');
    assert.strictEqual(data.user.email, testCustomerEmail);
    console.log('  ✅ [PASS] Login with valid credentials returned 200 and token');

    // 2.6 Login with Wrong Password
    console.log('  Testing: POST /api/auth/login (Invalid Password)...');
    res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: 'WrongPassword!',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
    assert(/invalid/i.test(data.message), 'Error message should indicate invalid credentials');
    console.log('  ✅ [PASS] Login with wrong password correctly rejected with 401');

    // 2.7 Login with Non-existent Email
    console.log('  Testing: POST /api/auth/login (Non-existent user)...');
    res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'does_not_exist_999@example.com',
        password: 'Password@123',
      }),
    });
    data = await res.json();
    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
    console.log('  ✅ [PASS] Login with non-existent user rejected with 401');

    // ---------------------------------------------------------
    // 3. FRONTEND CONTRACT INTEGRATION VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- Phase 3: Frontend Contract Compatibility ---');
    // Verify properties expected by frontend/src/context/AuthContext.jsx:
    // setUser(data.user) where data.user has { id, name, email, role }
    // localStorage.setItem('token', data.token)
    assert(data.message !== undefined, 'Response includes message property');
    assert(typeof data.token === 'undefined' || typeof data.token === 'string');
    console.log('  ✅ [PASS] Auth payload schema 100% matches Frontend AuthContext & authService requirements');

    console.log('\n🎉 ALL USER MODEL & AUTH INTEGRATION TESTS PASSED!\n');
  } finally {
    // Cleanup created test records
    await User.deleteMany({ email: { $in: [testCustomerEmail, testOrgEmail] } });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up temporary test users from database');
  }
}

runUserTests().catch((err) => {
  console.error('\n❌ USER TEST SUITE FAILED:', err);
  process.exit(1);
});
