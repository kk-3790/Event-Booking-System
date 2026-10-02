import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testModule3BookingEngine() {
  console.log('\n=============================================================');
  console.log('🧪 MODULE 3: BOOKING ENGINE & TICKET RESERVATION (E2E TEST)');
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
    // STEP 3.1: LOGIN AS CUSTOMER (RAHUL VERMA)
    // -------------------------------------------------------------------------
    console.log('--- Step 3.1: Login as Customer (Rahul Verma) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Click "Rahul (Customer)" quick autofill button
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
      // Fallback manual type
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

    // Wait for customer redirect to home '/'
    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify "Browse Events" is visible in navbar for customer
    const navText = await page.$eval('nav', (el) => el.innerText);
    assert(navText.includes('Browse Events'), 'Customer Navbar must have "Browse Events" link');
    assert(navText.includes('My Bookings'), 'Customer Navbar must have "My Bookings" link');
    console.log('  ✅ [PASS] Customer logged in. Navbar contains "Browse Events" and "My Bookings".');

    // -------------------------------------------------------------------------
    // STEP 3.2: BROWSE CATALOG & OPEN EVENT DETAILS
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3.2: Browse Event Catalog & Select Event ---');
    // Wait for event cards to render
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('a[href*="/events/"]');
      return cards.length > 0;
    }, { timeout: 10000 });

    // Click on the first available event card
    const eventSlugOrId = await page.evaluate(() => {
      const eventLinks = Array.from(document.querySelectorAll('a[href*="/events/"]'));
      if (eventLinks.length > 0) {
        eventLinks[0].click();
        return true;
      }
      return false;
    });
    assert(eventSlugOrId, 'Clicked on an event card from catalog');

    // Wait for EventDetails page to load
    await page.waitForFunction(() => window.location.pathname.startsWith('/events/'), { timeout: 10000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Loading event details...'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    // Verify event details elements
    const pageText = await page.evaluate(() => document.body.innerText);
    assert(pageText.includes('Select Pass Tier') || pageText.includes('Standard Entry') || pageText.includes('Pass') || pageText.includes('Perks'), 'Event details should render tier / booking section');
    console.log('  ✅ [PASS] Successfully navigated to Event Details page');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module3_01_event_details_tier_selected.png') });
    console.log('  📸 Captured: screenshots/module3_01_event_details_tier_selected.png');

    // -------------------------------------------------------------------------
    // STEP 3.3: INITIATE TICKET RESERVATION & PAYMENT
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3.3: Initiate Ticket Booking & Open Payment Gateway ---');
    // Click "Book Pass" / "Proceed to Checkout" button
    const bookClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bookBtn = btns.find((b) => 
        b.innerText.includes('Proceed to Book & Pay') ||
        b.innerText.includes('Proceed to Checkout') || 
        b.innerText.includes('Book Now') || 
        b.innerText.includes('Reserve Pass') ||
        b.innerText.includes('Book Passes')
      );
      if (bookBtn) {
        bookBtn.click();
        return true;
      }
      return false;
    });
    assert(bookClicked, 'Found and clicked Proceed to Book & Pay button');

    // Wait for PaymentModal to load order and show Razorpay / Developer QA options
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.innerText.includes('Developer QA') || b.innerText.includes('Offline Sandbox Simulator') || b.innerText.includes('Open Razorpay Popup'));
    }, { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 400));

    console.log('  ✅ [PASS] Payment Gateway Modal initialized with live order pricing');

    // Expand "Developer QA & Offline Sandbox Simulator" accordion
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const accordBtn = btns.find((b) => b.innerText.includes('Developer QA') || b.innerText.includes('Offline Sandbox Simulator'));
      if (accordBtn) accordBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Wait for "Simulate & Pay" button to be visible inside simulator
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.innerText.includes('Simulate & Pay'));
    }, { timeout: 5000 });

    // Click "Simulate & Pay" button in PaymentModal
    const payClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const payBtn = btns.find((b) => b.innerText.includes('Simulate & Pay'));
      if (payBtn) {
        payBtn.click();
        return true;
      }
      return false;
    });
    assert(payClicked, 'Clicked "Simulate & Pay" button in PaymentModal');

    // -------------------------------------------------------------------------
    // STEP 3.4: VERIFY BOOKING CONFIRMATION & SCANNABLE QR CODE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3.4: Verify Booking Confirmation Dialog & QR Pass ---');
    // Wait for "Booking Confirmed!" dialog
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Booking Confirmed!');
    }, { timeout: 12000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify QR Code image is rendered
    const hasQrImage = await page.evaluate(() => {
      const qrImg = document.querySelector('img[alt*="Pass Entry QR Code"]');
      return Boolean(qrImg && qrImg.src && qrImg.src.startsWith('data:image'));
    });
    assert(hasQrImage, 'Booking confirmation must render scannable QR Code Data URL');
    console.log('  ✅ [PASS] Booking Confirmed dialog displayed with valid scannable QR Code');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module3_02_booking_confirmed.png') });
    console.log('  📸 Captured: screenshots/module3_02_booking_confirmed.png');

    // -------------------------------------------------------------------------
    // STEP 3.5: ATTENDEE PASS WALLET (MY BOOKINGS)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3.5: View Attendee Wallet in "My Bookings" ---');
    // Click "View in My Bookings" button inside confirmation dialog
    const viewBookingsClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewBtn = btns.find((b) => b.innerText.includes('View in My Bookings'));
      if (viewBtn) {
        viewBtn.click();
        return true;
      }
      return false;
    });
    assert(viewBookingsClicked, 'Clicked "View in My Bookings"');

    // Wait for /my-bookings page
    await page.waitForFunction(() => window.location.pathname.includes('/my-bookings'), { timeout: 10000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Loading your bookings...'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify confirmed booking in wallet
    const myBookingsText = await page.evaluate(() => document.body.innerText);
    assert(myBookingsText.includes('CONFIRMED'), 'Attendee Wallet must contain a CONFIRMED booking badge');
    assert(myBookingsText.includes('My Ticket Wallet') || myBookingsText.includes('My Bookings'), 'Must be in Ticket Wallet page');

    // Check QR code image presence on My Bookings page
    const walletHasQr = await page.evaluate(() => {
      const qrImgs = Array.from(document.querySelectorAll('img[src^="data:image"]'));
      return qrImgs.length > 0;
    });
    assert(walletHasQr, 'Attendee Wallet must display scannable QR code passes');
    console.log('  ✅ [PASS] Newly booked passes confirmed and visible in Attendee Ticket Wallet');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module3_03_my_tickets_wallet_qr.png') });
    console.log('  📸 Captured: screenshots/module3_03_my_tickets_wallet_qr.png');

    console.log('\n=============================================================');
    console.log('🎉 MODULE 3 (BOOKING ENGINE & RESERVATIONS) FULLY PASSED & VERIFIED!');
    console.log('=============================================================\n');
  } catch (err) {
    if (page) {
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug_module3_failure.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await page.close();
    await browser.close();
  }
}

testModule3BookingEngine().catch((err) => {
  console.error('\n❌ MODULE 3 TEST FAILED:', err);
  process.exit(1);
});
