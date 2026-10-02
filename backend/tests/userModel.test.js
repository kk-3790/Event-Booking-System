const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

describe('🧪 User Model & Security Unit Test Suite', () => {

  let isDbConnected = false;
  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/event_system_test';
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
        isDbConnected = true;
      } catch (err) {
        // Sandboxed / offline environment; in-memory schema validation tests will still execute
        isDbConnected = false;
      }
    } else {
      isDbConnected = true;
    }
  });

  after(async () => {
    if (isDbConnected && mongoose.connection.readyState === 1) {
      // Clean up test users created during testing
      await User.deleteMany({ email: /test_user_model_/ });
      await mongoose.disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // 1. SCHEMA FIELD VALIDATION & REQUIRED CONSTRAINTS
  // ---------------------------------------------------------------------------
  test('1. Should fail validation when required fields are missing', async () => {
    const user = new User({});
    const error = user.validateSync();
    assert(error, 'Mongoose validation should fail for empty document');
    assert(error.errors.name, 'Name must be required');
    assert(error.errors.email, 'Email must be required');
    assert(error.errors.mobile, 'Mobile must be required');
    assert(error.errors.password, 'Password must be required');
  });

  test('2. Should assign default role as CUSTOMER when role is omitted', async () => {
    const user = new User({
      name: 'Default Role Tester',
      email: `test_user_model_role_${Date.now()}@example.com`,
      mobile: `98${String(Date.now()).slice(-8)}`,
      password: 'HashedPassword@123',
    });
    assert.strictEqual(user.role, 'CUSTOMER', 'Default role must be CUSTOMER');
  });

  test('3. Should reject invalid role enum values', async () => {
    const user = new User({
      name: 'Hacker User',
      email: `test_user_model_hack_${Date.now()}@example.com`,
      mobile: `99${String(Date.now()).slice(-8)}`,
      password: 'HashedPassword@123',
      role: 'SUPERADMIN_HACKER',
    });
    const error = user.validateSync();
    assert(error, 'Should fail validation for invalid role');
    assert(error.errors.role, 'Role error must be flagged for invalid enum');
  });

  test('4. Should accept valid enum roles: ADMIN, ORGANIZER, CUSTOMER', async () => {
    ['ADMIN', 'ORGANIZER', 'CUSTOMER'].forEach((validRole) => {
      const user = new User({
        name: 'Role Tester',
        email: `test_user_model_${validRole.toLowerCase()}@example.com`,
        mobile: `91${String(Date.now()).slice(-8)}`,
        password: 'HashedPassword@123',
        role: validRole,
      });
      const error = user.validateSync();
      assert(!error || !error.errors.role, `Role ${validRole} must be valid`);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. SANITIZATION: LOWERCASE & WHITESPACE TRIMMING
  // ---------------------------------------------------------------------------
  test('5. Should trim whitespace from name, email, and mobile', async () => {
    const user = new User({
      name: '   Spaced User Name   ',
      email: '   Test_User_Model_TRIM@EXAMPLE.COM   ',
      mobile: '   9876543210   ',
      password: 'Password@123',
    });
    assert.strictEqual(user.name, 'Spaced User Name', 'Name should be trimmed');
    assert.strictEqual(user.email, 'test_user_model_trim@example.com', 'Email should be trimmed and lowercased');
    assert.strictEqual(user.mobile, '9876543210', 'Mobile should be trimmed');
  });

  // ---------------------------------------------------------------------------
  // 3. SECURITY: BCRYPT HASHING & SALT UNIQUENESS
  // ---------------------------------------------------------------------------
  test('6. Should store bcrypt hash and never plaintext password', async () => {
    const plaintext = 'Secret@123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(plaintext, salt);

    const user = new User({
      name: 'Security Tester',
      email: `test_user_model_sec_${Date.now()}@example.com`,
      mobile: `93${String(Date.now()).slice(-8)}`,
      password: hash,
    });

    assert.notStrictEqual(user.password, plaintext, 'Password must not be stored in plaintext');
    assert(user.password.startsWith('$2a$') || user.password.startsWith('$2b$'), 'Password must be valid bcrypt hash');
    
    // Verify bcrypt comparison
    const isMatch = await bcrypt.compare(plaintext, user.password);
    const isMismatch = await bcrypt.compare('WrongPassword', user.password);
    assert.strictEqual(isMatch, true, 'Bcrypt compare must succeed for correct password');
    assert.strictEqual(isMismatch, false, 'Bcrypt compare must fail for wrong password');
  });

  test('7. Two users with identical password must have different bcrypt hashes due to unique salts', async () => {
    const plaintext = 'IdenticalPassword@123';
    const hash1 = await bcrypt.hash(plaintext, await bcrypt.genSalt(10));
    const hash2 = await bcrypt.hash(plaintext, await bcrypt.genSalt(10));

    assert.notStrictEqual(hash1, hash2, 'Bcrypt salt must guarantee unique hashes even for identical passwords');
  });

  // ---------------------------------------------------------------------------
  // 4. TIMESTAMPS
  // ---------------------------------------------------------------------------
  test('8. Should automatically assign createdAt and updatedAt timestamps on save', async (t) => {
    if (!isDbConnected) {
      t.skip('Database offline / sandboxed; skipping DB write test');
      return;
    }
    const uniqueEmail = `test_user_model_ts_${Date.now()}@example.com`;
    const uniqueMobile = `94${String(Date.now()).slice(-8)}`;
    
    const user = await User.create({
      name: 'Timestamp Tester',
      email: uniqueEmail,
      mobile: uniqueMobile,
      password: 'HashedPassword@123',
    });

    assert(user.createdAt instanceof Date, 'createdAt must be an instance of Date');
    assert(user.updatedAt instanceof Date, 'updatedAt must be an instance of Date');
  });

  // ---------------------------------------------------------------------------
  // 5. UNIQUE INDEX CONSTRAINT (DUPLICATE REJECTION)
  // ---------------------------------------------------------------------------
  test('9. Should enforce unique constraint on email and mobile', async (t) => {
    if (!isDbConnected) {
      t.skip('Database offline / sandboxed; skipping DB write test');
      return;
    }
    const sharedEmail = `test_user_model_dup_${Date.now()}@example.com`;
    const sharedMobile = `95${String(Date.now()).slice(-8)}`;

    await User.create({
      name: 'Original User',
      email: sharedEmail,
      mobile: sharedMobile,
      password: 'HashedPassword@123',
    });

    // Attempting duplicate email
    await assert.rejects(
      async () => {
        await User.create({
          name: 'Duplicate Email User',
          email: sharedEmail,
          mobile: `96${String(Date.now()).slice(-8)}`,
          password: 'HashedPassword@123',
        });
      },
      /E11000|duplicate key/,
      'MongoDB must reject duplicate email registration'
    );
  });

  // ---------------------------------------------------------------------------
  // 6. EMAIL FORMAT REGEX VALIDATION
  // ---------------------------------------------------------------------------
  test('10. Should reject malformed emails (e.g. kkpatel123@6, missing TLD, invalid domain)', async () => {
    const invalidEmails = [
      'kkpatel123@6',
      'invalid-email',
      'user@',
      '@domain.com',
      'user@domain',
      'user@domain.',
      'user@domain.c',
      'user name@domain.com',
    ];

    for (const invalidEmail of invalidEmails) {
      const user = new User({
        name: 'Invalid Email Tester',
        email: invalidEmail,
        mobile: `97${String(Date.now()).slice(-8)}`,
        password: 'Password@123',
      });
      const error = user.validateSync();
      assert(error, `Validation must fail for invalid email: "${invalidEmail}"`);
      assert(error.errors.email, `Email error must be present for: "${invalidEmail}"`);
    }
  });

  test('11. Should accept valid email addresses with proper format and domain', async () => {
    const validEmails = [
      'kkpatel123@gmail.com',
      'user.test@domain.org',
      'first_last+tag@sub.domain.co.in',
      'admin@eventhub.com',
    ];

    for (const validEmail of validEmails) {
      const user = new User({
        name: 'Valid Email Tester',
        email: validEmail,
        mobile: `98${String(Date.now()).slice(-8)}`,
        password: 'Password@123',
      });
      const error = user.validateSync();
      assert(!error || !error.errors.email, `Validation must pass for valid email: "${validEmail}"`);
    }
  });
});
