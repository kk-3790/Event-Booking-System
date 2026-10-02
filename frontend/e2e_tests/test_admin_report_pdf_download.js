import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { downloadReportPdf } from '../src/utils/reportPdfGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testAdminReportPdfDownload() {
  console.log('\n=============================================================');
  console.log('🧪 VERIFYING: ADMIN REPORT PDF DOWNLOAD & PRINT CAPABILITY');
  console.log('=============================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: TEST REPORT PDF GENERATOR DIRECTLY
  // -------------------------------------------------------------------------
  console.log('--- Test 1: Testing downloadReportPdf logic directly ---');
  const dummyReportData = {
    reportId: 'REP-7E81A09F',
    dateRange: { startDate: '2026-01-01', endDate: '2026-12-31' },
    totalBookings: 12,
    totalTicketsConfirmed: 18,
    totalRevenue: 15480,
    bookings: [
      {
        _id: '6701a2b3c4d5e6f7a8b9c0d1',
        user: { name: 'Rahul Verma', email: 'rahul@example.com' },
        event: { eventName: 'Global AI Summit 2026', ticketPrice: 799 },
        ticketCount: 2,
        bookingStatus: 'CONFIRMED',
        totalAmount: 1598,
      },
      {
        _id: '6701a2b3c4d5e6f7a8b9c0d2',
        user: { name: 'Anita Roy', email: 'anita@example.com' },
        event: { eventName: 'Music Concert 2026', ticketPrice: 499 },
        ticketCount: 1,
        bookingStatus: 'CONFIRMED',
        totalAmount: 524,
      },
    ],
  };

  const adminUser = { name: 'System Admin', email: 'admin@eventhub.com' };

  const result = downloadReportPdf({
    reportType: 'bookings',
    reportData: dummyReportData,
    adminUser,
  });

  assert(result?.filename, 'Expected PDF to have a valid filename');
  assert(result.filename.includes('EventHub_Booking_Audit_'), `Filename must match pattern, got: ${result.filename}`);
  console.log(`  ✅ [PASS] downloadReportPdf generated and validated: ${result.filename}`);

  // -------------------------------------------------------------------------
  // TEST 2: TEST ADMIN BI DASHBOARD REPORT UI IN CHROME
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Testing Admin Dashboard UI in Headless Chrome ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  try {
    console.log('  Navigating to /login...');
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

    assert(page.url().includes('/admin'), `Expected redirect to /admin, got ${page.url()}`);
    console.log('  ✅ [PASS] Logged in as System Admin');

    // Switch to "Audit Reports" tab
    console.log('  Clicking Audit Reports tab...');
    await page.evaluate(() => {
      const tabBtns = Array.from(document.querySelectorAll('button'));
      const reportsTab = tabBtns.find((b) => b.innerText.includes('Audit Reports') || b.innerText.includes('Reports'));
      if (reportsTab) reportsTab.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Click "Generate" report button
    console.log('  Clicking Generate report button...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find((b) => b.innerText.trim() === 'Generate');
      if (genBtn) genBtn.click();
    });

    // Wait for generated report container
    await page.waitForSelector('#admin-report-container', { timeout: 12000 });
    console.log('  ✅ [PASS] Report container loaded successfully from backend API');

    // Verify both "Download PDF" and "Print Report" buttons are rendered
    const hasDownloadBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#admin-report-container button'));
      return btns.some((b) => b.innerText.includes('Download PDF'));
    });
    const hasPrintBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#admin-report-container button'));
      return btns.some((b) => b.innerText.includes('Print Report'));
    });

    assert(hasDownloadBtn, 'Download PDF button must be present in report actions');
    assert(hasPrintBtn, 'Print Report button must be present in report actions');
    console.log('  ✅ [PASS] Both "Download PDF" and "Print Report" buttons are active and present');

    // Verify itemized ledger table is rendered in the UI
    const tableInfo = await page.evaluate(() => {
      const table = document.querySelector('#admin-report-container table');
      if (!table) return null;
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.innerText.trim());
      const hasSummary = !!table.querySelector('tfoot');
      return { rowCount: rows.length, headers, hasSummary };
    });

    assert(tableInfo, 'Itemized ledger table must be present inside #admin-report-container');
    assert(tableInfo.rowCount > 0, 'Table must contain transaction rows');
    assert(tableInfo.hasSummary, 'Table must contain summary total footer');
    console.log(`  ✅ [PASS] Itemized ledger table verified with ${tableInfo.rowCount} rows and summary footer`);

    // Capture screen view screenshot
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin_report_with_download_pdf_button.png'), fullPage: false });
    console.log('  📸 Captured screenshot: screenshots/admin_report_with_download_pdf_button.png');

    // -------------------------------------------------------------------------
    // TEST 3: VERIFY PRINT REPORT LAYOUT ISOLATION & PURITY
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Verifying Print Report Layout & Discarding Clutter ---');
    
    // Simulate print mode by adding printing-report class and emulating print media
    await page.evaluate(() => {
      document.body.classList.add('printing-report');
    });
    await page.emulateMediaType('print');
    await new Promise((r) => setTimeout(r, 600));

    const printVerification = await page.evaluate(() => {
      const isVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };

      const bannerHidden = !isVisible(document.querySelector('#admin-header-banner'));
      const kpisHidden = !isVisible(document.querySelector('#admin-overview-kpis'));
      const tabNavHidden = !isVisible(document.querySelector('#admin-tab-nav'));
      const formHidden = !isVisible(document.querySelector('#admin-report-form'));
      const reportVisible = isVisible(document.querySelector('#admin-report-container'));

      // Check letterhead and signoff in print
      const letterhead = document.querySelector('#admin-report-container .print\\:flex');
      const letterheadVisible = isVisible(letterhead);

      const signoff = document.querySelector('#admin-report-container .print\\:block');
      const signoffVisible = isVisible(signoff);
      const kpiCardsCount = document.querySelectorAll('#admin-report-container .report-kpi-card').length;

      return {
        bannerHidden,
        kpisHidden,
        tabNavHidden,
        formHidden,
        reportVisible,
        letterheadVisible,
        signoffVisible,
        kpiCardsCount,
      };
    });

    assert(printVerification.bannerHidden, 'Header banner must be hidden in print mode');
    assert(printVerification.kpisHidden, 'Overview KPI stats must be hidden in print mode');
    assert(printVerification.tabNavHidden, 'Tab navigation bar must be hidden in print mode');
    assert(printVerification.formHidden, 'Report generator form must be hidden in print mode');
    assert(printVerification.reportVisible, 'Report container must be visible in print mode');
    assert(printVerification.letterheadVisible, 'Official print letterhead must be visible in print mode');
    assert(printVerification.signoffVisible, 'Audit sign-off footer must be visible in print mode');
    assert.strictEqual(printVerification.kpiCardsCount, 3, 'Expected exactly 3 KPI summary cards');
    console.log('  ✅ [PASS] 3 KPI summary cards verified (4th card removed as requested)');
    console.log('  ✅ [PASS] All dashboard clutter is completely hidden in print mode');
    console.log('  ✅ [PASS] Official letterhead, itemized table, and compliance sign-off are verified in print');

    // Capture clean print screenshot
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_admin_print.png'), fullPage: true });
    console.log('  📸 Captured clean print screenshot: screenshots/test_admin_print.png');

    console.log('\n=============================================================');
    console.log('🎉 ADMIN REPORT PDF DOWNLOAD & PRINT VERIFICATION COMPLETE!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testAdminReportPdfDownload().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
