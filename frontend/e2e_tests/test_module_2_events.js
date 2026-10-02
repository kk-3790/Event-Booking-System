import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testModule2EventManagement() {
  console.log('\n=============================================================');
  console.log('🧪 MODULE 2: EVENT MANAGEMENT & ORGANIZER STUDIO (E2E TEST)');
  console.log('=============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  const testSuffix = Date.now();
  const testEventName = `Mod2 Grand Hackathon ${testSuffix}`;

  try {
    // -------------------------------------------------------------------------
    // STEP 2.1: LOGIN AS ORGANIZER (PRIYA)
    // -------------------------------------------------------------------------
    console.log('--- Step 2.1: Login as Organizer (Priya) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 10000 });

    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.includes('/organizer/events'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    assert(page.url().includes('/organizer/events'), 'Must be in Organizer Studio');

    // -------------------------------------------------------------------------
    // STEP 2.2: CREATE A NEW MULTI-TIER EVENT
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2.2: Publish New Event via Modal ---');
    // Wait for "Publish New Event" button to be rendered after data load
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.innerText.includes('Publish New Event'));
    }, { timeout: 10000 });

    // Click "Publish New Event" button via native DOM click
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.innerText.includes('Publish New Event'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    assert(clicked, 'Found and clicked Publish New Event button');
    await new Promise((r) => setTimeout(r, 500));

    // Fill event fields using React input value setter
    await page.waitForSelector('#eventName', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 300));

    // Future date: 15 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    const dateStr = futureDate.toISOString().slice(0, 10);

    await page.evaluate(({ name, venue, date, time, endTime, price, seats }) => {
      const setInput = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      setInput('eventName', name);
      setInput('venue', venue);
      setInput('date', date);
      setInput('time', time);
      setInput('endTime', endTime);
      setInput('ticketPrice', price);
      setInput('availableSeats', seats);
    }, {
      name: testEventName,
      venue: 'Tech Park Auditorium, Ahmedabad',
      date: dateStr,
      time: '10:00',
      endTime: '19:00',
      price: '799',
      seats: '200',
    });

    await new Promise((r) => setTimeout(r, 400));

    // Verify fields are populated in DOM
    const enteredName = await page.$eval('#eventName', (el) => el.value);
    assert.strictEqual(enteredName, testEventName, 'Event name must match in input field');

    // Submit event creation
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Verify event is in table
    const tableText = await page.$eval('table', (el) => el.innerText);
    assert(tableText.includes(testEventName), `Table must contain newly created event "${testEventName}"`);
    console.log(`  ✅ [PASS] Successfully created and published: "${testEventName}"`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module2_01_event_published.png') });
    console.log('  📸 Captured: screenshots/module2_01_event_published.png');

    // -------------------------------------------------------------------------
    // STEP 2.3: SEARCH & FILTER WITHIN LISTINGS
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2.3: Search & Filter within Organizer Listings ---');
    await page.type('input[placeholder*="Search your listings"]', testEventName);
    await new Promise((r) => setTimeout(r, 400));

    const searchResults = await page.$eval('table', (el) => el.innerText);
    assert(searchResults.includes(testEventName), 'Filtered search table must show matching event');
    console.log('  ✅ [PASS] Real-time table filter correctly isolated the test event');

    // Clear search
    await page.click('input[placeholder*="Search your listings"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // STEP 2.4: EDIT EVENT DETAILS
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // STEP 2.4: EDIT EVENT DETAILS
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2.4: Edit Event Modal & Update ---');
    // Click edit button for the newly created test event
    const editClicked = await page.evaluate((name) => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const targetRow = rows.find((r) => r.innerText.includes(name));
      if (targetRow) {
        const editBtn = targetRow.querySelector('button[title="Edit Event"]');
        if (editBtn) {
          editBtn.click();
          return true;
        }
      }
      return false;
    }, testEventName);
    assert(editClicked, `Found and clicked Edit button for "${testEventName}"`);
    await page.waitForSelector('#venue', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));

    // Update venue via React setter
    await page.evaluate((newVenue) => {
      const el = document.getElementById('venue');
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, newVenue);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 'Grand Innovation Hall, Sector 28');
    await new Promise((r) => setTimeout(r, 300));

    // Submit edit form
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const updatedText = await page.$eval('table', (el) => el.innerText);
    assert(updatedText.includes('Grand Innovation Hall'), 'Table must reflect updated venue name');
    console.log('  ✅ [PASS] Event venue successfully updated to "Grand Innovation Hall"');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module2_02_event_edited.png') });
    console.log('  📸 Captured: screenshots/module2_02_event_edited.png');

    // -------------------------------------------------------------------------
    // STEP 2.5: DELETE EVENT MODAL & REMOVAL
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2.5: Delete Event Confirmation ---');
    const deleteClicked = await page.evaluate((name) => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const targetRow = rows.find((r) => r.innerText.includes(name));
      if (targetRow) {
        const delBtn = targetRow.querySelector('button[title="Delete Event"]');
        if (delBtn) {
          delBtn.click();
          return true;
        }
      }
      return false;
    }, testEventName);
    assert(deleteClicked, `Found and clicked Delete button for "${testEventName}"`);
    await new Promise((r) => setTimeout(r, 600));

    // Confirm deletion inside modal
    const confirmClicked = await page.evaluate(() => {
      const modalBtns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = modalBtns.find((b) => b.innerText.includes('Delete Event') || b.innerText.includes('Confirm') || b.innerText.includes('Delete Listing'));
      if (confirmBtn) {
        confirmBtn.click();
        return true;
      }
      return false;
    });
    assert(confirmClicked, 'Found and clicked confirmation button in delete modal');
    await new Promise((r) => setTimeout(r, 1500));

    const postDeleteTable = await page.$eval('table', (el) => el.innerText);
    assert(!postDeleteTable.includes(testEventName), 'Event must be completely removed from table');
    console.log('  ✅ [PASS] Event successfully deleted and cleaned up from table');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'module2_03_event_deleted.png') });
    console.log('  📸 Captured: screenshots/module2_03_event_deleted.png');

    console.log('\n=============================================================');
    console.log('🎉 MODULE 2 (EVENT MANAGEMENT & STUDIO) FULLY PASSED & VERIFIED!');
    console.log('=============================================================\n');
  } catch (err) {
    if (page) {
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug_module2_failure.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await page.close();
    await browser.close();
  }
}

testModule2EventManagement().catch((err) => {
  console.error('\n❌ MODULE 2 TEST FAILED:', err);
  process.exit(1);
});
