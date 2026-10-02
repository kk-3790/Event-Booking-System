import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5001/api';

async function testModule1Authentication() {
  console.log('\n=============================================================');
  console.log('🧪 MODULE 1: AUTHENTICATION & USER MANAGEMENT (E2E TEST)');
  console.log('=============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  const testSuffix = Date.now();
  const newCustomerEmail = `mod1_cust_${testSuffix}@example.com`;
  const newCustomerMobile = `92${String(testSuffix).slice(-8)}`;
  const testPassword = 'Password@123';

  try {
    // -------------------------------------------------------------------------
    // TEST 1.1: REGISTRATION FLOW
    // -------------------------------------------------------------------------
    console.log('--- Step 1.1: Customer Registration Flow ---');
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0', timeout: 10000 });

    await page.type('input[name="name"]', 'Module1 Test User');
    await page.type('input[name="email"]', newCustomerEmail);
    await page.type('input[name="mobile"]', newCustomerMobile);
    await page.type('input[name="password"]', testPassword);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module1_01_registration_filled.png') });
    console.log('  📸 Captured: screenshots/module1_01_registration_filled.png');

    // Submit registration
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    // Verify token & user saved in localStorage
    const authState = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      user: JSON.parse(localStorage.getItem('user') || 'null'),
    }));

    assert(authState.token, 'Token must be saved in localStorage upon registration');
    assert.strictEqual(authState.user?.email, newCustomerEmail.toLowerCase());
    assert.strictEqual(authState.user?.role, 'CUSTOMER');
    console.log(`  ✅ [PASS] Registered new user with JWT and role CUSTOMER: ${authState.user?.name}`);

    // -------------------------------------------------------------------------
    // TEST 1.2: AUTHENTICATED NAVBAR & PROTECTED ROUTES FOR CUSTOMER
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1.2: Customer Session & RBAC Route Protection ---');
    const pageText = await page.evaluate(() => document.body.innerText);
    assert(pageText.includes('Module1 Test User') || pageText.includes('CUSTOMER'), 'Navbar must show user name/role');
    console.log('  ✅ [PASS] Customer profile and role badge correctly rendered in Navbar');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module1_02_customer_authenticated.png') });
    console.log('  📸 Captured: screenshots/module1_02_customer_authenticated.png');

    // Try accessing protected organizer route /organizer/events as a CUSTOMER
    console.log('  Testing RBAC: Customer attempting to navigate to /organizer/events...');
    await page.goto(`${BASE_URL}/organizer/events`, { waitUntil: 'networkidle0', timeout: 8000 });
    const blockedUrl = page.url();
    // ProtectedRoute redirects unauthorized roles to home '/'
    assert(!blockedUrl.includes('/organizer/events') || blockedUrl === `${BASE_URL}/`, `Customer must be blocked from organizer route. Current URL: ${blockedUrl}`);
    console.log('  ✅ [PASS] ProtectedRoute blocked Customer from accessing /organizer/events');

    // -------------------------------------------------------------------------
    // TEST 1.3: LOGOUT FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1.3: Logout & Session Teardown ---');
    const logoutBtn = await page.$('button[title="Log Out"]');
    assert(logoutBtn, 'Must find Log Out button in Navbar');
    await logoutBtn.click();
    await new Promise((r) => setTimeout(r, 1000));

    const loggedOutState = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      user: localStorage.getItem('user'),
    }));
    assert(!loggedOutState.token, 'Token must be removed after logout');
    assert(!loggedOutState.user, 'User must be removed after logout');
    console.log('  ✅ [PASS] Token & User completely purged from storage upon logout');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module1_03_logged_out_state.png') });
    console.log('  📸 Captured: screenshots/module1_03_logged_out_state.png');

    // -------------------------------------------------------------------------
    // TEST 1.4: LOGIN WITH DEFAULT PRIYA (ORGANIZER) CREDENTIALS
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1.4: Login with Default Organizer (Priya) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Verify default fields are prefilled for Priya
    const loginEmail = await page.$eval('input[name="email"]', (el) => el.value);
    assert.strictEqual(loginEmail, 'organizer@eventhub.com', 'Login form defaults to Priya');

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    const orgUrl = page.url();
    assert(orgUrl.includes('/organizer/events'), `Expected redirect to /organizer/events, got: ${orgUrl}`);
    console.log(`  ✅ [PASS] Priya successfully logged in and redirected to Organizer Studio: ${orgUrl}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module1_04_organizer_authenticated.png') });
    console.log('  📸 Captured: screenshots/module1_04_organizer_authenticated.png');

    console.log('\n=============================================================');
    console.log('🎉 MODULE 1 (AUTH & USER MANAGEMENT) FULLY PASSED & VERIFIED!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testModule1Authentication().catch((err) => {
  console.error('\n❌ MODULE 1 TEST FAILED:', err);
  process.exit(1);
});
