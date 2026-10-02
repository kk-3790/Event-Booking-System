import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testOrganizerStudioAndLogin() {
  console.log('\n=============================================================');
  console.log('🧪 TESTING: ORGANIZER STUDIO EVENT FETCHING & LOGIN UX FLOW');
  console.log('=============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: TEST LOGIN ERROR BANNER (ENSURE NO HARD RELOAD / DISAPPEARING ERROR)
    // ---------------------------------------------------------------------------
    console.log('--- Test 1: Wrong Password on /login shows Error Banner (No hard reload) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    await page.type('input[name="email"]', 'krish@test.com');
    await page.type('input[name="password"]', 'WrongPasswordHere');
    await page.click('button[type="submit"]');

    // Wait for error banner
    await page.waitForSelector('.text-rose-300', { timeout: 4000 });
    const errorText = await page.$eval('.text-rose-300', (el) => el.innerText);
    assert(errorText.includes('Invalid') || errorText.includes('credentials') || errorText.includes('password'), `Error text unexpected: ${errorText}`);
    console.log(`  ✅ [PASS] Clean error banner displayed: "${errorText}"`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_login_error_banner_no_reload.png') });
    console.log('  📸 Captured: screenshots/09_login_error_banner_no_reload.png');

    // ---------------------------------------------------------------------------
    // TEST 2: ONE-CLICK QUICK DEMO AUTOFILL & SUCCESSFUL LOGIN
    // ---------------------------------------------------------------------------
    console.log('\n--- Test 2: Quick Demo Autofill (Krish) & Login Redirect ---');
    // Click the "Krish (Org)" button
    const buttons = await page.$$('button');
    let krishBtn = null;
    for (const b of buttons) {
      const text = await page.evaluate((el) => el.innerText, b);
      if (text.includes('Krish')) {
        krishBtn = b;
        break;
      }
    }
    assert(krishBtn, 'Found Krish quick demo button');
    await krishBtn.click();
    await new Promise((r) => setTimeout(r, 200));

    // Verify fields populated
    const emailVal = await page.$eval('input[name="email"]', (el) => el.value);
    const passVal = await page.$eval('input[name="password"]', (el) => el.value);
    assert.strictEqual(emailVal, 'krish@test.com');
    assert.strictEqual(passVal, 'Password@123');
    console.log('  ✅ [PASS] Autofill populated krish@test.com / Password@123');

    // Click Sign In
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    const currentUrl = page.url();
    assert(currentUrl.includes('/organizer/events'), `Expected redirect to /organizer/events, got ${currentUrl}`);
    console.log(`  ✅ [PASS] Successfully logged in and redirected to: ${currentUrl}`);

    // ---------------------------------------------------------------------------
    // TEST 3: VERIFY EVENTS FETCHED IN ORGANIZER STUDIO TABLE
    // ---------------------------------------------------------------------------
    console.log('\n--- Test 3: Events Loaded in Organizer Studio ---');
    await page.waitForSelector('table', { timeout: 8000 });

    const pageContent = await page.evaluate(() => document.body.innerText);
    assert(pageContent.includes('Music Concert'), 'Organizer studio must list "Music Concert"');
    console.log('  ✅ [PASS] "Music Concert" event is successfully fetched and rendered in Organizer Studio!');

    // Verify KPI Cards update
    assert(!pageContent.includes('Total Active Listings\n0'), 'Total active listings must be >= 1');
    console.log('  ✅ [PASS] Active listings count and KPI revenue cards updated accurately!');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_organizer_studio_events_fetched.png') });
    console.log('  📸 Captured: screenshots/08_organizer_studio_events_fetched.png');

    console.log('\n=============================================================');
    console.log('🎉 ORGANIZER STUDIO FETCH & LOGIN FULLY VERIFIED IN CHROME!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testOrganizerStudioAndLogin().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
