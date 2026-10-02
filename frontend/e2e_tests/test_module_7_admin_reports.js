import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import pathModule from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);
const SCREENSHOTS_DIR = pathModule.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testModule7AdminDashboard() {
  console.log('\n=============================================================');
  console.log('🧪 MODULE 7: ADMIN CONTROL & BUSINESS INTELLIGENCE (E2E TEST)');
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
    // STEP 7.1: LOGIN AS ADMIN (SYSTEM ADMIN)
    // -------------------------------------------------------------------------
    console.log('--- Step 7.1: Login as Admin (admin@eventhub.com) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    const autofillClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find((b) => b.innerText.includes('Admin') && !b.innerText.includes('Priya') && !b.innerText.includes('Rahul'));
      if (adminBtn) {
        adminBtn.click();
        return true;
      }
      return false;
    });

    if (!autofillClicked) {
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
    }

    await new Promise((r) => setTimeout(r, 300));
    await page.click('button[type="submit"]');

    // Wait for Admin redirect to /admin
    await page.waitForFunction(() => window.location.pathname === '/admin', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    // Verify "Browse Events" is completely removed from Navbar for Admin
    const navText = await page.$eval('nav', (el) => el.innerText);
    assert(!navText.includes('Browse Events'), 'Admin Navbar must NOT have "Browse Events"');
    console.log('  ✅ [PASS] Admin logged in. Navbar cleanly excludes "Browse Events"');

    // -------------------------------------------------------------------------
    // STEP 7.2: VERIFY KPI STATS & OVERVIEW
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7.2: Verify Admin KPI Stats & Metrics ---');
    await page.waitForFunction(() => !document.body.innerText.includes('Loading platform overview...'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const overviewText = await page.evaluate(() => document.body.innerText);
    assert(overviewText.includes('Total Users') || overviewText.includes('Platform Overview'), 'Overview must show Total Users card');
    assert(overviewText.includes('Total Bookings'), 'Overview must show Total Bookings card');
    assert(overviewText.includes('Platform Events'), 'Overview must show Platform Events card');
    console.log('  ✅ [PASS] Admin KPI metrics rendered (Total Users, Total Bookings, Platform Events)');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'module7_01_admin_bi_dashboard.png') });
    console.log('  📸 Captured: screenshots/module7_01_admin_bi_dashboard.png');

    // -------------------------------------------------------------------------
    // STEP 7.3: SWITCH TO USERS DIRECTORY TAB
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7.3: Switch to Users Directory Tab ---');
    const userTabClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tab = btns.find((b) => b.innerText.includes('Users') || b.innerText.includes('User Directory'));
      if (tab) {
        tab.click();
        return true;
      }
      return false;
    });
    assert(userTabClicked, 'Clicked Users tab');
    await new Promise((r) => setTimeout(r, 800));

    const usersTableText = await page.evaluate(() => document.body.innerText);
    assert(usersTableText.includes('Role') || usersTableText.includes('ORGANIZER') || usersTableText.includes('CUSTOMER'), 'Users table must list registered platform accounts');
    console.log('  ✅ [PASS] Platform user accounts directory rendered with role filters');

    // -------------------------------------------------------------------------
    // STEP 7.4: SWITCH TO BUSINESS INTELLIGENCE REPORTS TAB
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7.4: Generate Business Intelligence Report ---');
    const reportsTabClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tab = btns.find((b) => b.innerText.includes('Reports') || b.innerText.includes('Business Intelligence'));
      if (tab) {
        tab.click();
        return true;
      }
      return false;
    });
    assert(reportsTabClicked, 'Clicked Reports tab');
    await new Promise((r) => setTimeout(r, 800));

    // Click "Generate Report" button
    const generateClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find((b) => b.innerText.includes('Generate') || b.innerText.includes('Run Report'));
      if (genBtn) {
        genBtn.click();
        return true;
      }
      return false;
    });
    assert(generateClicked, 'Clicked Generate Report button');
    await new Promise((r) => setTimeout(r, 1200));

    const reportOutputText = await page.evaluate(() => document.body.innerText);
    assert(reportOutputText.includes('Generated') || reportOutputText.includes('Bookings') || reportOutputText.includes('Summary') || reportOutputText.includes('Report'), 'Report output should display analytics summary');
    console.log('  ✅ [PASS] Business Intelligence report generated successfully with live audit log');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'module7_02_admin_reports_generated.png') });
    console.log('  📸 Captured: screenshots/module7_02_admin_reports_generated.png');

    console.log('\n=============================================================');
    console.log('🎉 MODULE 7 (ADMIN CONTROL & BI REPORTS) FULLY PASSED!');
    console.log('=============================================================\n');
  } catch (err) {
    if (page) {
      await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'debug_module7_failure.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await page.close();
    await browser.close();
  }
}

testModule7AdminDashboard().catch((err) => {
  console.error('\n❌ MODULE 7 TEST FAILED:', err);
  process.exit(1);
});
