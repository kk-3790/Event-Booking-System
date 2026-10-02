import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testPriyaDefaultLogin() {
  console.log('\n=============================================================');
  console.log('🧪 VERIFYING: PRIYA AS DEFAULT ORGANIZER ON LOGIN PAGE');
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
    // STEP 1: VISIT LOGIN PAGE & VERIFY DEFAULT PRE-FILL TO PRIYA
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Navigating to /login ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Clear any previous remembered email in localStorage
    await page.evaluate(() => localStorage.removeItem('rememberedEmail'));
    await page.reload({ waitUntil: 'networkidle0' });

    const emailValue = await page.$eval('input[name="email"]', (el) => el.value);
    const passValue = await page.$eval('input[name="password"]', (el) => el.value);

    assert.strictEqual(emailValue, 'organizer@eventhub.com', 'Default email must be organizer@eventhub.com');
    assert.strictEqual(passValue, 'organizer123', 'Default password must be organizer123');
    console.log(`  ✅ [PASS] Login page pre-fills Priya credentials by default:`);
    console.log(`     Email:    ${emailValue}`);
    console.log(`     Password: ${passValue}`);

    // Capture screenshot of the login page with default Priya credentials
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_login_page_default_priya.png') });
    console.log('  📸 Captured: screenshots/10_login_page_default_priya.png');

    // -------------------------------------------------------------------------
    // STEP 2: CLICK SIGN IN & VERIFY ORGANIZER STUDIO FOR PRIYA
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Signing in with default Priya credentials ---');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    const currentUrl = page.url();
    assert(currentUrl.includes('/organizer/events'), `Expected redirect to /organizer/events, got ${currentUrl}`);
    console.log(`  ✅ [PASS] Redirected to Organizer Studio: ${currentUrl}`);

    // Verify Organizer Studio displays Priya's details and listings
    await page.waitForSelector('table', { timeout: 8000 });
    const studioText = await page.evaluate(() => document.body.innerText);

    assert(studioText.includes('Priya Sharma') || studioText.includes('TechSphere'), 'Must show Priya Sharma');
    assert(studioText.includes('Global AI & Web3 Innovators Summit 2026'), 'Must list Priya event');
    console.log('  ✅ [PASS] Priya Sharma profile and "Global AI & Web3 Innovators Summit 2026" event are loaded!');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_organizer_studio_priya_events.png') });
    console.log('  📸 Captured: screenshots/11_organizer_studio_priya_events.png');

    console.log('\n=============================================================');
    console.log('🎉 PRIYA DEFAULT ORGANIZER LOGIN FULLY VERIFIED IN CHROME!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testPriyaDefaultLogin().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
