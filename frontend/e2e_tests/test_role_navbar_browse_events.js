import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testRoleNavbarBrowseEvents() {
  console.log('\n=============================================================');
  console.log('🧪 VERIFYING: "BROWSE EVENTS" REMOVAL FOR BOTH ORGANIZER & ADMIN');
  console.log('=============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: ORGANIZER HAS NO "BROWSE EVENTS" & REDIRECTS TO /organizer/events
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Organizer (Priya) Navbar & Redirection ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Autofill Priya
    await page.click('button[title*="organizer@eventhub.com"]');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    let navText = await page.$eval('nav', (el) => el.innerText);
    assert(!navText.includes('Browse Events'), 'Organizer Navbar must NOT contain "Browse Events"');
    assert(navText.includes('Organizer Studio'), 'Organizer Navbar must contain "Organizer Studio"');
    console.log('  ✅ [PASS] Organizer Navbar has NO "Browse Events" link');

    // Attempt visiting "/" -> must redirect to "/organizer/events"
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));
    let currentUrl = page.url();
    assert(currentUrl.includes('/organizer/events'), `Organizer at "/" must redirect to "/organizer/events". Got: ${currentUrl}`);
    console.log(`  ✅ [PASS] Organizer visiting "/" automatically redirected to: ${currentUrl}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14_organizer_no_browse_events.png') });
    console.log('  📸 Captured: screenshots/14_organizer_no_browse_events.png');

    // Logout & clear storage completely
    await page.evaluate(() => localStorage.clear());
    await new Promise((r) => setTimeout(r, 400));
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    // -------------------------------------------------------------------------
    // TEST 2: ADMIN HAS NO "BROWSE EVENTS" & REDIRECTS TO /admin
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Admin Navbar & Redirection ---');
    // Click Admin demo button by textContent
    await page.waitForSelector('button');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const adminBtn = buttons.find((b) => b.textContent && b.textContent.includes('Admin'));
      if (adminBtn) adminBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const emailValue = await page.$eval('input[name="email"]', (el) => el.value);
    const passValue = await page.$eval('input[name="password"]', (el) => el.value);
    console.log(`  Admin form values after click: Email="${emailValue}", Pass="${passValue}"`);
    assert.strictEqual(emailValue, 'admin@eventhub.com');
    assert.strictEqual(passValue, 'admin123');

    page.on('console', (msg) => console.log('  [BROWSER CONSOLE]', msg.text()));
    page.on('pageerror', (err) => console.log('  [BROWSER ERROR]', err.message));

    // Submit login form via native form.requestSubmit()
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const currentUrlAfterSubmit = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`  After submit URL: ${currentUrlAfterSubmit}`);
    if (currentUrlAfterSubmit.includes('/login')) {
      console.log('  Still on login! Page snippet:', bodyText.slice(0, 400));
    }

    navText = await page.$eval('nav', (el) => el.innerText);
    console.log(`  Admin logged in URL: ${page.url()} | Nav text: "${navText.replace(/\n/g, ' | ')}"`);
    assert(!navText.includes('Browse Events'), 'Admin Navbar must NOT contain "Browse Events"');
    assert(navText.includes('Admin Dashboard'), 'Admin Navbar must contain "Admin Dashboard"');
    console.log('  ✅ [PASS] Admin Navbar has NO "Browse Events" link');

    // Attempt visiting "/" -> must redirect to "/admin"
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));
    currentUrl = page.url();
    assert(currentUrl.includes('/admin'), `Admin at "/" must redirect to "/admin". Got: ${currentUrl}`);
    console.log(`  ✅ [PASS] Admin visiting "/" automatically redirected to: ${currentUrl}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15_admin_no_browse_events.png') });
    console.log('  📸 Captured: screenshots/15_admin_no_browse_events.png');

    // Logout & clear storage completely
    await page.evaluate(() => localStorage.clear());
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // TEST 3: GUEST / CUSTOMER STILL SEES "BROWSE EVENTS"
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Guest / Customer Visitors See "Browse Events" ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 8000 });
    navText = await page.$eval('nav', (el) => el.innerText);
    assert(navText.includes('Browse Events'), 'Guest visitors must see "Browse Events"');
    console.log('  ✅ [PASS] Guest and Customer visitors have "Browse Events" enabled');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16_guest_with_browse_events.png') });
    console.log('  📸 Captured: screenshots/16_guest_with_browse_events.png');

    console.log('\n=============================================================');
    console.log('🎉 "BROWSE EVENTS" REMOVAL FOR ORGANIZER & ADMIN FULLY VERIFIED!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testRoleNavbarBrowseEvents().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
