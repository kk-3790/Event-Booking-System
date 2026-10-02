import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve('/Users/patelkrishkaushikkumar/.gemini/antigravity/brain/35ff3e23-1287-4fef-afc6-abdd7a0a76a9/screenshots');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
  console.log('--- Starting Organizer Reports & Admin Updates E2E Verification ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960'],
    defaultViewport: { width: 1440, height: 960 },
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------
    // PART 1: ORGANIZER STUDIO REPORTS
    // -------------------------------------------------------------
    console.log('1. Navigating to login for Organizer...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 15000 });

    // Click Organizer autofill button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const orgBtn = btns.find((b) => b.innerText.includes('Organizer'));
      if (orgBtn) orgBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    console.log('Organizer logged in. Current URL:', page.url());
    assert(page.url().includes('/organizer'), `Expected URL to include /organizer, got: ${page.url()}`);

    // Wait for tab navigation
    await page.waitForSelector('#organizer-tab-nav', { timeout: 10000 });
    console.log('Found #organizer-tab-nav.');

    // Click "Revenue & Audit Reports" tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#organizer-tab-nav button'));
      const repTab = btns.find((b) => b.innerText.includes('Revenue & Audit Reports') || b.innerText.includes('Reports'));
      if (repTab) repTab.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Wait for report form
    await page.waitForSelector('#organizer-report-form', { timeout: 10000 });
    console.log('Found #organizer-report-form.');

    // Click Generate report button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#organizer-report-form button'));
      const genBtn = btns.find((b) => b.innerText.trim() === 'Generate');
      if (genBtn) genBtn.click();
    });

    // Wait for report container to render
    await page.waitForSelector('#organizer-report-container', { timeout: 12000 });
    console.log('Found #organizer-report-container.');

    // Count KPI cards: MUST BE EXACTLY 3 CARDS
    const kpiCardsCount = await page.$$eval('#organizer-report-container .report-kpi-card', (cards) => cards.length);
    console.log('Organizer Report KPI cards count:', kpiCardsCount);
    assert.strictEqual(kpiCardsCount, 3, `Expected exactly 3 KPI cards, found ${kpiCardsCount}`);

    // Test Download PDF button
    const hasDownloadBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#organizer-report-container button'));
      const dlBtn = btns.find((b) => b.innerText.includes('Download PDF'));
      if (dlBtn) {
        dlBtn.click();
        return true;
      }
      return false;
    });
    console.log('Organizer Download PDF button clicked successfully:', hasDownloadBtn);
    assert(hasDownloadBtn, 'Download PDF button should exist in Organizer report header');

    // Save screenshot of Organizer Report
    const organizerReportScreenshot = path.join(SCREENSHOTS_DIR, 'organizer_revenue_audit_report_3_cards.png');
    await page.screenshot({ path: organizerReportScreenshot, fullPage: true });
    console.log('✅ [PASS] Saved organizer report screenshot to:', organizerReportScreenshot);

    // -------------------------------------------------------------
    // PART 2: ADMIN DASHBOARD (SOFT-DELETE & PAYMENT FAILED & 3 KPI)
    // -------------------------------------------------------------
    console.log('\n2. Logging out and testing Admin Dashboard...');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 15000 });

    // Click Admin autofill button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find((b) => b.innerText.includes('Admin'));
      if (adminBtn) adminBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    assert(page.url().includes('/admin'), `Expected URL to include /admin, got: ${page.url()}`);
    console.log('Admin logged in. Current URL:', page.url());

    // 2a. All Events Tab: Verify Cancelled / Deleted filter button exists
    console.log('Checking All Events tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#admin-tab-nav button'));
      const eventsTab = btns.find((b) => b.innerText.includes('All Events'));
      if (eventsTab) eventsTab.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const hasCancelledBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cBtn = btns.find((b) => b.innerText.includes('Cancelled / Deleted') || b.innerText.includes('Cancelled'));
      if (cBtn) {
        cBtn.click();
        return true;
      }
      return false;
    });
    console.log('Found Cancelled / Deleted filter button:', hasCancelledBtn);
    assert(hasCancelledBtn, 'Cancelled / Deleted filter button must exist on All Events tab');

    const adminEventsScreenshot = path.join(SCREENSHOTS_DIR, 'admin_events_cancelled_soft_delete_filter.png');
    await page.screenshot({ path: adminEventsScreenshot, fullPage: true });
    console.log('✅ [PASS] Saved admin events screenshot');

    // 2b. Bookings Oversight Tab: Verify Payment Failed filter button exists
    console.log('Checking Bookings Oversight tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#admin-tab-nav button'));
      const bkgTab = btns.find((b) => b.innerText.includes('Bookings'));
      if (bkgTab) bkgTab.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const hasPaymentFailedBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const pfBtn = btns.find((b) => b.innerText.includes('Payment Failed'));
      if (pfBtn) {
        pfBtn.click();
        return true;
      }
      return false;
    });
    console.log('Found Payment Failed filter button:', hasPaymentFailedBtn);
    assert(hasPaymentFailedBtn, 'Payment Failed filter button must exist on All Bookings tab');

    const adminBookingsScreenshot = path.join(SCREENSHOTS_DIR, 'admin_bookings_payment_failed_filter.png');
    await page.screenshot({ path: adminBookingsScreenshot, fullPage: true });
    console.log('✅ [PASS] Saved admin bookings screenshot');

    // 2c. Admin Reports Tab: Verify exactly 3 KPI cards (Total Records, Confirmed Tickets, Gross Revenue)
    console.log('Checking Admin Reports tab for 3 KPI cards...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#admin-tab-nav button'));
      const repTab = btns.find((b) => b.innerText.includes('Audit Reports') || b.innerText.includes('Reports'));
      if (repTab) repTab.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#admin-report-form button'));
      const genBtn = btns.find((b) => b.innerText.trim() === 'Generate');
      if (genBtn) genBtn.click();
    });

    await page.waitForSelector('#admin-report-container', { timeout: 12000 });
    const adminKpis = await page.$$eval('#admin-report-container .report-kpi-card', (cards) => cards.length);
    console.log('Admin Report KPI cards count:', adminKpis);
    assert.strictEqual(adminKpis, 3, `Expected exactly 3 KPI cards on Admin Report, found ${adminKpis}`);

    // Verify 4th card ("Ledger Audit Status") is completely absent
    const hasAuditStatusCard = await page.evaluate(() => {
      const text = document.querySelector('#admin-report-container')?.innerText || '';
      return text.includes('Ledger Audit Status');
    });
    console.log('Is 4th card "Ledger Audit Status" present?:', hasAuditStatusCard);
    assert.strictEqual(hasAuditStatusCard, false, '4th card "Ledger Audit Status" must be removed');

    const adminReportScreenshot = path.join(SCREENSHOTS_DIR, 'admin_report_3_cards_no_4th_card.png');
    await page.screenshot({ path: adminReportScreenshot, fullPage: true });
    console.log('✅ [PASS] Saved admin report 3-card screenshot');

    console.log('\n🎉 ALL TESTS AND ASSERTIONS PASSED WITH FLYING COLORS!');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
