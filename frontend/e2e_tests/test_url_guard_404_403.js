import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import pathModule from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);
const SCREENSHOTS_DIR = pathModule.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testUrlGuards() {
  console.log('\n=============================================================');
  console.log('🧪 TEST: URL MODIFICATION GUARDS (404 NOT FOUND & 403 FORBIDDEN)');
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
    // TEST 1: MODIFIED UNKNOWN URL -> 404 NOT FOUND
    // -------------------------------------------------------------------------
    console.log('--- Test 1: User types an unknown URL (/mystery-secret-path) ---');
    await page.goto(`${BASE_URL}/mystery-secret-path`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const notFoundText = await page.evaluate(() => document.body.innerText);
    assert(notFoundText.includes('404'), 'Must display 404 badge');
    assert(notFoundText.includes('Page Not Available') || notFoundText.includes('Resource Not Found'), 'Must display clear 404 title');
    assert(notFoundText.includes('/mystery-secret-path'), 'Must show the typed path in details');
    console.log('  ✅ [PASS] 404 Page Not Found correctly displayed with path highlight');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'url_guard_01_404_not_found.png') });
    console.log('  📸 Captured: screenshots/url_guard_01_404_not_found.png');

    // -------------------------------------------------------------------------
    // TEST 2: CUSTOMER MODIFIES URL TO /admin -> 403 ACCESS DENIED
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Customer logs in and manually types /admin in URL bar ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Login as Customer (Rahul)
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
    await page.click('button[type="submit"]');

    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Customer manually modifies URL to /admin
    console.log('  Navigating customer to restricted URL: /admin');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const deniedText = await page.evaluate(() => document.body.innerText);
    assert(deniedText.includes('403') || deniedText.includes('Permission Denied'), 'Must display 403 Permission Denied');
    assert(deniedText.includes('CUSTOMER'), 'Must display user active role CUSTOMER');
    assert(deniedText.includes('ADMIN'), 'Must specify required role ADMIN');
    console.log('  ✅ [PASS] 403 Access Denied displayed for customer attempting /admin access');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'url_guard_02_customer_403_access_denied.png') });
    console.log('  📸 Captured: screenshots/url_guard_02_customer_403_access_denied.png');

    // -------------------------------------------------------------------------
    // TEST 3: ORGANIZER MODIFIES URL TO /admin & USES SMART RETURN BUTTON
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Organizer logs in, visits /admin, and clicks smart return button ---');
    // Clear customer session first
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));

    // Submit default organizer Priya via requestSubmit
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForFunction(() => window.location.pathname.includes('/organizer/events'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Organizer manually navigates to /admin
    console.log('  Navigating organizer to restricted URL: /admin');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const orgDeniedText = await page.evaluate(() => document.body.innerText);
    assert(orgDeniedText.includes('403') || orgDeniedText.includes('Permission Denied'), 'Must display 403 Permission Denied');
    assert(orgDeniedText.includes('ORGANIZER'), 'Must display active role ORGANIZER');
    assert(orgDeniedText.includes('Go to Organizer Studio'), 'Must show smart button "Go to Organizer Studio"');
    console.log('  ✅ [PASS] 403 Access Denied rendered with role-aware "Go to Organizer Studio" button');

    // Click smart button "Go to Organizer Studio"
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const studioLink = links.find((l) => l.innerText.includes('Organizer Studio'));
      if (studioLink) studioLink.click();
    });

    await page.waitForFunction(() => window.location.pathname === '/organizer/events', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    assert.strictEqual(page.url(), `${BASE_URL}/organizer/events`, 'Must safely return to /organizer/events');
    console.log('  ✅ [PASS] Smart return safely brought Organizer back to Organizer Studio');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'url_guard_03_organizer_smart_return_studio.png') });
    console.log('  📸 Captured: screenshots/url_guard_03_organizer_smart_return_studio.png');

    console.log('\n=============================================================');
    console.log('🎉 URL GUARDS & 404/403 PROTECTION FULLY TESTED & VERIFIED!');
    console.log('=============================================================\n');
  } catch (err) {
    if (page) {
      await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'debug_url_guard_failure.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await page.close();
    await browser.close();
  }
}

testUrlGuards().catch((err) => {
  console.error('\n❌ URL GUARD TEST FAILED:', err);
  process.exit(1);
});
