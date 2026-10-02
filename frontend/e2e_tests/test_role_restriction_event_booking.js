import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import pathModule from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);
const SCREENSHOTS_DIR = pathModule.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testRoleRestrictions() {
  console.log('\n=============================================================');
  console.log('🧪 TEST: RESTRICT ORGANIZER & ADMIN FROM EVENT PAGE & BOOKING');
  console.log('=============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: ORGANIZER RESTRICTIONS (/events/:id, /my-bookings, /)
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Verify Organizer is Restricted from Event Page & Booking ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Login as Organizer (Priya)
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForFunction(() => window.location.pathname.includes('/organizer/events'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // 1.1 Attempt to visit public event details page /events/sampleId
    console.log('  Organizer attempting to visit: /events/670000000000000000000001');
    await page.goto(`${BASE_URL}/events/670000000000000000000001`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert(page.url().includes('/organizer/events'), `Organizer must be redirected to /organizer/events, got: ${page.url()}`);
    console.log('  ✅ [PASS] Organizer restricted from /events/:id -> Redirected to /organizer/events');

    // 1.2 Attempt to visit customer bookings wallet /my-bookings
    console.log('  Organizer attempting to visit: /my-bookings');
    await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert(page.url().includes('/organizer/events'), `Organizer must be redirected to /organizer/events, got: ${page.url()}`);
    console.log('  ✅ [PASS] Organizer restricted from /my-bookings -> Redirected to /organizer/events');

    // 1.3 Attempt to visit public browse catalog /
    console.log('  Organizer attempting to visit: /');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert(page.url().includes('/organizer/events'), `Organizer must be redirected to /organizer/events, got: ${page.url()}`);
    console.log('  ✅ [PASS] Organizer restricted from / -> Redirected to /organizer/events');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'restrict_01_organizer_redirected_studio.png') });
    console.log('  📸 Captured: screenshots/restrict_01_organizer_redirected_studio.png');

    // -------------------------------------------------------------------------
    // TEST 2: ADMIN RESTRICTIONS (/events/:id, /my-bookings, /)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Verify Admin is Restricted from Event Page & Booking ---');
    // Clear session
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));

    // Autofill Admin credentials
    await page.evaluate(() => {
      const setVal = (selector, val) => {
        const el = document.querySelector(selector);
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      setVal('input[name="email"]', 'admin@eventhub.com');
      setVal('input[name="password"]', 'admin123');
    });
    await new Promise((r) => setTimeout(r, 300));

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForFunction(() => window.location.pathname === '/admin', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // 2.1 Attempt to visit public event details page /events/sampleId
    console.log('  Admin attempting to visit: /events/670000000000000000000001');
    await page.goto(`${BASE_URL}/events/670000000000000000000001`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert(page.url().includes('/admin'), `Admin must be redirected to /admin, got: ${page.url()}`);
    console.log('  ✅ [PASS] Admin restricted from /events/:id -> Redirected to /admin');

    // 2.2 Attempt to visit customer bookings wallet /my-bookings
    console.log('  Admin attempting to visit: /my-bookings');
    await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert(page.url().includes('/admin'), `Admin must be redirected to /admin, got: ${page.url()}`);
    console.log('  ✅ [PASS] Admin restricted from /my-bookings -> Redirected to /admin');

    // 2.3 Attempt to visit public browse catalog /
    console.log('  Admin attempting to visit: /');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert(page.url().includes('/admin'), `Admin must be redirected to /admin, got: ${page.url()}`);
    console.log('  ✅ [PASS] Admin restricted from / -> Redirected to /admin');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'restrict_02_admin_redirected_dashboard.png') });
    console.log('  📸 Captured: screenshots/restrict_02_admin_redirected_dashboard.png');

    // -------------------------------------------------------------------------
    // TEST 3: CUSTOMER IS STILL FULLY PERMITTED TO EVENT PAGE & BOOKING
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Verify Customer is Permitted to Event Page & Booking ---');
    // Clear session
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));

    // Autofill Customer credentials
    await page.evaluate(() => {
      const setVal = (selector, val) => {
        const el = document.querySelector(selector);
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      setVal('input[name="email"]', 'customer@eventhub.com');
      setVal('input[name="password"]', 'customer123');
    });
    await new Promise((r) => setTimeout(r, 300));

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Customer opens event details
    await page.waitForFunction(() => document.querySelectorAll('a[href*="/events/"]').length > 0, { timeout: 10000 });
    await page.evaluate(() => {
      const link = document.querySelector('a[href*="/events/"]');
      if (link) link.click();
    });

    await page.waitForFunction(() => window.location.pathname.startsWith('/events/'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const customerDetailsText = await page.evaluate(() => document.body.innerText);
    assert(customerDetailsText.includes('Proceed to Book & Pay'), 'Customer must be able to view booking controls');
    console.log('  ✅ [PASS] Customer permitted on /events/:id with active booking controls');

    // Customer visits /my-bookings
    await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert.strictEqual(page.url(), `${BASE_URL}/my-bookings`, 'Customer must remain on /my-bookings');
    console.log('  ✅ [PASS] Customer permitted on /my-bookings wallet');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'restrict_03_customer_allowed_event_booking.png') });
    console.log('  📸 Captured: screenshots/restrict_03_customer_allowed_event_booking.png');

    console.log('\n=============================================================');
    console.log('🎉 ALL ROLE RESTRICTIONS FOR EVENT PAGE & BOOKING VERIFIED!');
    console.log('=============================================================\n');
  } catch (err) {
    if (page) {
      await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'debug_restriction_failure.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await page.close();
    await browser.close();
  }
}

testRoleRestrictions().catch((err) => {
  console.error('\n❌ ROLE RESTRICTION TEST FAILED:', err);
  process.exit(1);
});
