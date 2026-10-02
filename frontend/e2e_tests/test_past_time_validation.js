import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5001/api';

async function testPastTimeValidation() {
  console.log('\n=============================================================');
  console.log('🧪 VERIFYING FIX: PAST TIME & DATE VALIDATION (BACKEND & FRONTEND)');
  console.log('=============================================================\n');

  const testSuffix = Date.now();
  const orgEmail = `past_org_${testSuffix}@example.com`;
  const orgPassword = 'Password@123';
  const orgMobile = `95${String(testSuffix).slice(-8)}`;

  // ---------------------------------------------------------------------------
  // STEP 1: BACKEND API TEST — MUST REJECT PAST DATE & PAST START TIME
  // ---------------------------------------------------------------------------
  console.log('--- Step 1: Backend API Rejection of Past Events ---');

  // Register an organizer
  const orgRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Past Time Validator',
      email: orgEmail,
      mobile: orgMobile,
      password: orgPassword,
      role: 'ORGANIZER',
    }),
  });
  const orgData = await orgRes.json();
  const orgToken = orgData.token;

  // 1.1 Try creating event with yesterday's date
  console.log('  Testing: Backend rejects yesterday date (2026-09-01)...');
  let res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${orgToken}`,
    },
    body: JSON.stringify({
      eventName: `Yesterday Event ${testSuffix}`,
      category: 'Workshop',
      venue: 'Hall X',
      date: '2026-09-01', // in the past
      time: '10:00',
      endTime: '12:00',
      ticketPrice: 300,
      availableSeats: 50,
    }),
  });
  let data = await res.json();
  assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
  assert(/cannot be in the past/i.test(data.message), `Error message should mention past: ${data.message}`);
  console.log(`  ✅ [PASS] Backend rejected past date with HTTP 400: "${data.message}"`);

  // 1.2 Try creating event today with an earlier start time (e.g. 01:00 AM)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  console.log(`  Testing: Backend rejects past start time today (${todayStr} at 01:00 AM)...`);
  res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${orgToken}`,
    },
    body: JSON.stringify({
      eventName: `Earlier Today Event ${testSuffix}`,
      category: 'Workshop',
      venue: 'Hall X',
      date: todayStr,
      time: '01:00', // early morning today
      endTime: '02:00',
      ticketPrice: 300,
      availableSeats: 50,
    }),
  });
  data = await res.json();
  assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
  assert(/cannot be in the past/i.test(data.message));
  console.log(`  ✅ [PASS] Backend rejected earlier time today with HTTP 400: "${data.message}"`);

  // ---------------------------------------------------------------------------
  // STEP 2: FRONTEND UI TEST IN REAL CHROME BROWSER
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 2: Frontend Chrome UI Validation ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  try {
    // 2.1 Login as Organizer
    console.log('  Logging in as Organizer on UI...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });
    await page.type('input[name="email"]', orgEmail, { delay: 10 });
    await page.type('input[name="password"]', orgPassword, { delay: 10 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1000));

    // 2.2 Go to Organizer Studio
    console.log('  Navigating to Organizer Studio (/organizer/events)...');
    await page.goto(`${BASE_URL}/organizer/events`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Open "Publish Event" modal
    await page.waitForSelector('button');
    const buttons = await page.$$('button');
    let publishBtn = null;
    for (const b of buttons) {
      const text = await page.evaluate((el) => el.innerText, b);
      if (text.includes('Publish Event') || text.includes('Create Event') || text.includes('Add Event') || text.includes('New Event')) {
        publishBtn = b;
        break;
      }
    }
    assert(publishBtn, 'Found "Publish Event" button');
    await publishBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    page.on('console', (msg) => console.log('  [BROWSER CONSOLE]', msg.text()));
    page.on('pageerror', (err) => console.log('  [BROWSER ERROR]', err.message));

    // Verify HTML5 min attribute is set on Date input to prevent picking past dates
    const dateMin = await page.$eval('#date', (el) => el.getAttribute('min'));
    assert.strictEqual(dateMin, todayStr, `HTML5 date input must have min="${todayStr}"`);
    console.log(`  ✅ [PASS] Date input HTML5 min attribute is strictly set to today (${todayStr})`);

    // Fill in required eventName and venue
    await page.waitForSelector('#eventName', { timeout: 5000 });
    await page.type('#eventName', `Past Test Event ${testSuffix}`);
    await page.type('#venue', 'Grand Cyber Arena');

    // Fill Ticket Price & Available Seats
    await page.type('#ticketPrice', '500');
    await page.type('#availableSeats', '50');

    // Fill Date as Today via React setter
    await page.evaluate((val) => {
      const el = document.getElementById('date');
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, todayStr);

    // Fill Start Time as 01:00 (past time today)
    await page.evaluate((val) => {
      const el = document.getElementById('time');
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, '01:00');

    // Fill End Time as 02:00
    await page.evaluate((val) => {
      const el = document.getElementById('endTime');
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, '02:00');

    const formVals = await page.evaluate(() => ({
      date: document.getElementById('date')?.value,
      time: document.getElementById('time')?.value,
      endTime: document.getElementById('endTime')?.value,
      name: document.getElementById('eventName')?.value,
    }));
    console.log('  Form inputs before submit:', JSON.stringify(formVals));

    // Submit form
    console.log('  Submitting form with earlier start time today...');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    }
    await new Promise((r) => setTimeout(r, 1000));

    // Check what is in the modal or page
    const fullText = await page.evaluate(() => document.body.innerText);
    const modalErrorText = await page.evaluate(() => {
      const el = document.querySelector('.text-rose-300');
      return el ? el.innerText : null;
    });
    console.log('  Found modal error element text:', modalErrorText);

    assert(
      (modalErrorText && (modalErrorText.includes('already passed today') || modalErrorText.includes('cannot be in the past'))) ||
      fullText.includes('already passed today') ||
      fullText.includes('cannot be in the past'),
      `Modal must display past time error! modalErrorText="${modalErrorText}"`
    );
    console.log(`  ✅ [PASS] Frontend immediately blocked submission and displayed warning: "${modalErrorText}"`);

    // Capture screenshot showing the validation error in UI
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_past_time_validation_error.png') });
    console.log('  📸 Captured: screenshots/07_past_time_validation_error.png');

    console.log('\n=============================================================');
    console.log('🎉 PAST DATE & TIME VALIDATION FULLY VERIFIED IN BACKEND & UI!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testPastTimeValidation().catch((err) => {
  console.error('\n❌ PAST TIME VALIDATION TEST FAILED:', err);
  process.exit(1);
});
