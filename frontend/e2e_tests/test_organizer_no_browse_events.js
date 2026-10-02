import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testOrganizerNoBrowseEvents() {
  console.log('\n=============================================================');
  console.log('🧪 VERIFYING: "BROWSE EVENTS" REMOVED FOR ORGANIZERS');
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
    // STEP 1: LOGIN AS ORGANIZER (PRIYA)
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Login as Organizer (Priya) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    // -------------------------------------------------------------------------
    // STEP 2: VERIFY "BROWSE EVENTS" IS NOT IN NAVBAR FOR ORGANIZER
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Verify Navbar Navigation Links for Organizer ---');
    const navText = await page.$eval('nav', (el) => el.innerText);
    console.log(`  Navbar text: "${navText.replace(/\n/g, ' | ')}"`);

    assert(!navText.includes('Browse Events'), '"Browse Events" must NOT appear in Navbar for Organizers');
    assert(navText.includes('Organizer Studio'), '"Organizer Studio" must be present in Navbar');
    console.log('  ✅ [PASS] "Browse Events" is completely absent from Navbar for Organizers!');

    // Capture screenshot of Organizer Navbar
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12_organizer_navbar_no_browse_events.png') });
    console.log('  📸 Captured: screenshots/12_organizer_navbar_no_browse_events.png');

    // -------------------------------------------------------------------------
    // STEP 3: ATTEMPT TO VISIT "/" MANUALLY (SHOULD REDIRECT TO /organizer/events)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Attempting manual navigation to "/" while logged in as Organizer ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    const finalUrl = page.url();
    assert(finalUrl.includes('/organizer/events'), `Organizer should be redirected away from "/" to "/organizer/events". Current: ${finalUrl}`);
    console.log(`  ✅ [PASS] Organizer navigating to "/" was automatically redirected to: ${finalUrl}`);

    // -------------------------------------------------------------------------
    // STEP 4: LOGOUT & VERIFY "BROWSE EVENTS" SHOWS FOR GUESTS & CUSTOMERS
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Logout & Verify Guest/Customer Navbar ---');
    const logoutBtn = await page.$('button[title="Log Out"]');
    if (logoutBtn) await logoutBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    const guestNavText = await page.$eval('nav', (el) => el.innerText);
    assert(guestNavText.includes('Browse Events'), '"Browse Events" must be present for Guests/Customers');
    console.log('  ✅ [PASS] "Browse Events" correctly reappears for guest/customer visitors');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_customer_navbar_with_browse_events.png') });
    console.log('  📸 Captured: screenshots/13_customer_navbar_with_browse_events.png');

    console.log('\n=============================================================');
    console.log('🎉 "BROWSE EVENTS" REMOVAL FOR ORGANIZER FULLY VERIFIED!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testOrganizerNoBrowseEvents().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
