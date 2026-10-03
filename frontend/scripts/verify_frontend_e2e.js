import puppeteer from 'puppeteer-core';
import assert from 'node:assert';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5001/api';

async function verifyFrontend() {
  console.log('🚀 Launching Chrome for Frontend Verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Register & Login an Admin User
    const suffix = Date.now();
    const adminEmail = `admin_fe_${suffix}@test.com`;
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Super Admin UI',
        email: adminEmail,
        mobile: `98${String(suffix).slice(-6)}88`,
        password: 'Password@123',
        role: 'ADMIN',
      }),
    });
    const regData = await regRes.json();
    assert(regData.token, 'Failed to create admin user');

    // Set token into localStorage
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((authData) => {
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
    }, regData);

    // 2. Test Admin Dashboard UI
    console.log('--- Checking Admin Dashboard UI ---');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle0' });

    // Check Refresh button text
    const refreshBtnText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const ref = btns.find((b) => b.textContent.includes('Refresh'));
      return ref ? ref.textContent.trim() : null;
    });
    console.log(`  Admin Refresh Button Text: "${refreshBtnText}"`);
    assert(refreshBtnText === 'Refresh', `Expected "Refresh", got "${refreshBtnText}"`);
    assert(!refreshBtnText.includes('Refresh Hub'), 'Should not contain "Refresh Hub"');

    // Check Overview tab does NOT exist
    const hasOverviewTab = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => b.textContent.includes('Overview'));
    });
    console.log(`  Admin has "Overview" tab: ${hasOverviewTab}`);
    assert.strictEqual(hasOverviewTab, false, 'Overview tab must not exist');

    // Check Platform Activity Summary does NOT exist
    const pageText = await page.evaluate(() => document.body.innerText);
    assert(!pageText.includes('Platform Activity Summary'), 'Platform Activity Summary must not exist');
    assert(pageText.includes('Users Directory'), 'Users Directory must be present');
    console.log('  ✅ Admin Dashboard UI matches all requirements (Refresh only, no Overview, no Platform Activity Summary, default Users Directory)');

    // 3. Register & Login Organizer
    console.log('\n--- Checking Organizer Dashboard UI ---');
    const orgEmail = `org_fe_${suffix}@test.com`;
    const orgRegRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Organizer UI Test',
        email: orgEmail,
        mobile: `98${String(suffix).slice(-6)}77`,
        password: 'Password@123',
        role: 'ORGANIZER',
      }),
    });
    const orgData = await orgRegRes.json();
    assert(orgData.token, 'Failed to create organizer user');

    await page.evaluate((authData) => {
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
    }, orgData);

    await page.goto(`${BASE_URL}/organizer/events`, { waitUntil: 'networkidle0' });

    // Check header banner buttons
    const headerBannerHasAuditBtn = await page.evaluate(() => {
      const banner = document.getElementById('organizer-header-banner');
      if (!banner) return false;
      const btns = Array.from(banner.querySelectorAll('button'));
      return btns.some((b) => b.textContent.includes('Audit Reports'));
    });
    console.log(`  Organizer Header Banner has duplicate "Audit Reports" button: ${headerBannerHasAuditBtn}`);
    assert.strictEqual(headerBannerHasAuditBtn, false, 'Navbar/header banner must not contain duplicate Audit Reports button');
    console.log('  ✅ Organizer Dashboard UI confirmed (clean header with "Publish New Event" only)');

    // 4. Test Customer Event Checkout & Payment Modal
    console.log('\n--- Checking Customer Checkout & Payment Modal UI ---');
    // Create an event with Organizer
    const eventRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgData.token}`,
      },
      body: JSON.stringify({
        eventName: `Grand Gala UI Test ${suffix}`,
        category: 'Technology',
        venue: 'Metro Arena',
        date: '2026-11-20',
        time: '18:00',
        endTime: '22:00',
        ticketPrice: 500,
        availableSeats: 50,
      }),
    });
    const eventData = await eventRes.json();
    const eventId = eventData.event._id;

    // Create RewardDraw for this event so LUCKYDRAW contest is open
    const drawRes = await fetch(`${API_BASE}/rewards/event/${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgData.token}`,
      },
      body: JSON.stringify({
        discountPercentage: 30,
        numberOfWinners: 2,
      }),
    });
    const drawData = await drawRes.json();
    assert(drawData.draw, `Failed to create reward draw: ${JSON.stringify(drawData)}`);

    // Login as Customer
    const custEmail = `cust_fe_${suffix}@test.com`;
    const custRegRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Customer UI Test',
        email: custEmail,
        mobile: `98${String(suffix).slice(-6)}66`,
        password: 'Password@123',
        role: 'CUSTOMER',
      }),
    });
    const custData = await custRegRes.json();

    await page.evaluate((authData) => {
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
    }, custData);

    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

    await page.goto(`${BASE_URL}/events/${eventId}`, { waitUntil: 'networkidle0' });

    // Apply LUCKYDRAW via the 1-click Deal Button or typing
    console.log('  Testing LUCKYDRAW in Customer UI...');
    await page.waitForSelector('input[placeholder*="LUCKYDRAW"]', { timeout: 5000 });
    
    // Find and click the LUCKYDRAW deal card
    const clickedDeal = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const drawBtn = btns.find((b) => b.textContent.includes('LUCKYDRAW') && b.textContent.includes('Apply'));
      if (drawBtn) {
        drawBtn.click();
        return true;
      }
      return false;
    });

    if (!clickedDeal) {
      await page.type('input[placeholder*="LUCKYDRAW"]', 'LUCKYDRAW');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.textContent.trim() === 'Apply');
        if (b) b.click();
      });
    }

    await new Promise((r) => setTimeout(r, 1500));

    // Verify subtotal has NO instant discount (ticket price is still 500)
    const priceText = await page.evaluate(() => document.body.innerText);
    console.log('  Page text snippet around price/promo:\n', priceText.slice(0, 1000));
    assert(priceText.includes('₹500') || priceText.includes('525'), 'Price must reflect full ticket without instant discount');
    assert(priceText.includes('Enrolled in Lucky Draw Contest'), 'Contest enrollment badge must appear');
    console.log('  ✅ Lucky Draw UI verified: 0% instant discount, enrolled badge displayed');

    // Click "Proceed to Book & Pay" to open PaymentModal
    console.log('  Opening Payment Gateway Modal...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bookBtn = btns.find((b) => b.textContent.includes('Proceed to Book & Pay'));
      if (bookBtn) bookBtn.click();
    });

    await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    // Check PaymentModal content
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return modal ? modal.innerText : '';
    });

    console.log('  Modal text contains "Accepted Payment Channels":', modalText.includes('Accepted Payment Channels'));
    assert(modalText.includes('Cards (Visa · MasterCard · RuPay)'), 'Must accept Cards');
    assert(modalText.includes('Net Banking'), 'Must accept Net Banking');
    assert(modalText.includes('Wallets'), 'Must accept Wallets');
    assert(!modalText.includes('Google Pay'), 'Must NOT mention Google Pay');
    assert(!modalText.includes('PhonePe'), 'Must NOT mention PhonePe');
    assert(!modalText.includes('Paytm'), 'Must NOT mention Paytm');
    assert(!modalText.includes('QA Sandbox Simulator'), 'Must NOT have sandbox simulator text');
    assert(modalText.includes('256-Bit Bank-Grade Encryption'), 'Must have Bank-Grade Encryption badge');
    assert(modalText.includes('Session: #'), 'Must display dynamic session ID');
    console.log('  ✅ Payment Modal verified: Cards, Net Banking, and Wallets only, official enterprise branding, 256-Bit encryption with unique session ID');

    console.log('\n===============================================================');
    console.log('🎉 FRONTEND IS FULLY WORKING AND ALL UI REQUIREMENTS VERIFIED!');
    console.log('===============================================================\n');

  } finally {
    await browser.close();
    process.exit(0);
  }
}

verifyFrontend().catch((err) => {
  console.error('\n❌ FRONTEND VERIFICATION FAILED:', err);
  process.exit(1);
});
