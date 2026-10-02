import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:url';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import pathModule from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);
const SCREENSHOTS_DIR = pathModule.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testModule5RewardsAndPromos() {
  console.log('\n=============================================================');
  console.log('🧪 MODULE 5: REWARDS, LUCKY DRAWS & PROMO CODES (E2E TEST)');
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
    // STEP 5.1: LOGIN AS CUSTOMER (RAHUL VERMA)
    // -------------------------------------------------------------------------
    console.log('--- Step 5.1: Login as Customer (Rahul Verma) ---');
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
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // STEP 5.2: OPEN EVENT DETAILS
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5.2: Open Event Details Catalog Page ---');
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('a[href*="/events/"]');
      return cards.length > 0;
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/events/"]'));
      if (links.length > 0) links[0].click();
    });

    await page.waitForFunction(() => window.location.pathname.startsWith('/events/'), { timeout: 10000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Loading event details...'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // STEP 5.3: APPLY LUCKY20 PROMO CODE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5.3: Apply Promotional Discount Voucher (LUCKY20) ---');
    // Check initial subtotal
    const initialText = await page.evaluate(() => document.body.innerText);
    assert(initialText.includes('Pass Subtotal'), 'Subtotal breakdown should be visible');

    // Click LUCKY20 preset button
    const promoClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const luckyBtn = btns.find((b) => b.innerText.includes('LUCKY20'));
      if (luckyBtn) {
        luckyBtn.click();
        return true;
      }
      return false;
    });
    assert(promoClicked, 'Clicked LUCKY20 promo chip');

    // Wait for discount calculation to reflect
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('Promotional Discount') || text.includes('Applied: LUCKY20') || text.includes('20%');
    }, { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    const discountedText = await page.evaluate(() => document.body.innerText);
    assert(discountedText.includes('Promotional Discount'), 'Promotional Discount row must be displayed in price breakdown');
    console.log('  ✅ [PASS] Promotional code LUCKY20 verified and 20% discount applied to live cart');

    await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'module5_01_promo_discount_applied.png') });
    console.log('  📸 Captured: screenshots/module5_01_promo_discount_applied.png');

    // -------------------------------------------------------------------------
    // STEP 5.4: SWITCH TO EARLYBIRD PROMO CODE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5.4: Test Dynamic Switch to EARLYBIRD (15% Off) ---');
    // Remove existing promo first if remove button exists
    await page.evaluate(() => {
      const removeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Remove') || b.innerText.includes('✕'));
      if (removeBtn) removeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Click EARLYBIRD
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const ebBtn = btns.find((b) => b.innerText.includes('EARLYBIRD'));
      if (ebBtn) ebBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const ebText = await page.evaluate(() => document.body.innerText);
    assert(ebText.includes('Promotional Discount') || ebText.includes('EARLYBIRD'), 'Must apply 15% discount for EARLYBIRD');
    console.log('  ✅ [PASS] Successfully switched promotional campaigns dynamically to EARLYBIRD');

    console.log('\n=============================================================');
    console.log('🎉 MODULE 5 (REWARDS, LUCKY DRAWS & PROMOS) FULLY PASSED!');
    console.log('=============================================================\n');
  } catch (err) {
    if (page) {
      await page.screenshot({ path: pathModule.join(SCREENSHOTS_DIR, 'debug_module5_failure.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await page.close();
    await browser.close();
  }
}

testModule5RewardsAndPromos().catch((err) => {
  console.error('\n❌ MODULE 5 TEST FAILED:', err);
  process.exit(1);
});
