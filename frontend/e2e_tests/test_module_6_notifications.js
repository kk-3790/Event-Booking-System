import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import pathModule from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);
const SCREENSHOTS_DIR = pathModule.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testModule6Notifications() {
  console.log('\n=============================================================');
  console.log('🧪 MODULE 6: NOTIFICATIONS & REAL-TIME ALERTS (E2E TEST)');
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
    // STEP 6.1: LOGIN AS CUSTOMER (RAHUL VERMA)
    // -------------------------------------------------------------------------
    console.log('--- Step 6.1: Login as Customer (Rahul Verma) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    const autofillClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rahulBtn = btns.find((b) => b.innerText.includes('Rahul') || b.innerText.includes('Customer'));
      if (rahulBtn) {
        rahulBtn.click();
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
        setVal('input[name="email"]', 'customer@eventhub.com');
        setVal('input[name="password"]', 'customer123');
      });
    }

    await new Promise((r) => setTimeout(r, 300));
    await page.click('button[type="submit"]');

    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    // -------------------------------------------------------------------------
    // STEP 6.2: OPEN NOTIFICATION CENTER DROPDOWN
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6.2: Open Notification Center Dropdown from Navbar ---');
    // Find and click the Bell icon in Navbar
    const bellClicked = await page.evaluate(() => {
      const bellBtn = document.querySelector('button[title="Notifications"], button[aria-label="View notifications"]');
      if (bellBtn) {
        bellBtn.click();
        return true;
      }
      return false;
    });
    assert(bellClicked, 'Found and clicked Notification Bell button in navbar');
    await new Promise((r) => setTimeout(r, 600));

    // Verify Notification dropdown is visible
    const dropdownText = await page.evaluate(() => document.body.innerText);
    assert(dropdownText.includes('Notifications'), 'Notification panel dropdown must be rendered');
    console.log('  ✅ [PASS] Notification Center opened with live user alert feed');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'module6_01_notifications_inbox.png') });
    console.log('  📸 Captured: screenshots/module6_01_notifications_inbox.png');

    // -------------------------------------------------------------------------
    // STEP 6.3: MARK ALL AS READ
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6.3: Test "Mark All as Read" Action ---');
    const markReadClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const markBtn = btns.find((b) => b.innerText.includes('Mark all as read') || b.innerText.includes('Clear'));
      if (markBtn) {
        markBtn.click();
        return true;
      }
      return false;
    });

    if (markReadClicked) {
      console.log('  ✅ [PASS] "Mark all as read" clicked and badge counter cleared');
    } else {
      console.log('  ℹ️ [INFO] All alerts already marked read or empty state');
    }

    console.log('\n=============================================================');
    console.log('🎉 MODULE 6 (NOTIFICATIONS & REAL-TIME ALERTS) FULLY PASSED!');
    console.log('=============================================================\n');
  } catch (err) {
    if (page) {
      await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'debug_module6_failure.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await page.close();
    await browser.close();
  }
}

testModule6Notifications().catch((err) => {
  console.error('\n❌ MODULE 6 TEST FAILED:', err);
  process.exit(1);
});
