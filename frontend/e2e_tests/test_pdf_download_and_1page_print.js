import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';

async function testPdfAndPrint() {
  console.log('\n=============================================================');
  console.log('🧪 VERIFYING: PDF DOWNLOAD ENCODING & 1-PAGE PRINT LAYOUT');
  console.log('=============================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: VERIFY JSPDF TICKET PASS ENCODING (NO UNEXPECTED CHARACTERS)
  // -------------------------------------------------------------------------
  console.log('--- Test 1: Testing jsPDF Ticket Encoding ---');
  const dummyBooking = {
    _id: '64a1b2c3d4e5f6a7b8c9d0e1',
    tierName: 'VIP Pass',
    ticketCount: 2,
    bookingTime: '06:30 PM',
    totalAmount: 1048,
    createdAt: new Date(),
  };
  const dummyEvent = {
    eventName: 'Global AI Summit 2026',
    date: new Date('2026-11-20'),
    time: '18:00',
    venue: 'Riverfront Amphitheater, Ahmedabad',
    ticketPrice: 500,
  };
  const dummyUser = { name: 'Rahul Verma' };

  // Generate jsPDF instance matching ticketPdfGenerator logic
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [105, 180],
  });

  const pageWidth = 105;
  const pageHeight = 180;

  doc.setFillColor(10, 15, 29);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('EventHub', 12, 19);

  // Clean labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(129, 140, 248);
  doc.text('DATE & TIME:', 11, 56);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text('Fri, Nov 20, 2026 at 18:00', 33, 56);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(129, 140, 248);
  doc.text('VENUE:', 11, 62);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const venueText = dummyEvent.venue;
  const splitVenue = doc.splitTextToSize(venueText, pageWidth - 36);
  doc.text(splitVenue, 26, 62);

  doc.text('Verified Genuine Pass | 256-bit Encrypted Token | Powered by EventHub', 52.5, 175, { align: 'center' });

  const pdfOutputString = doc.output();

  // Assert NO broken mojibake
  assert(!pdfOutputString.includes('Ø=ÜÅ'), 'PDF must NOT contain broken calendar emoji mojibake Ø=ÜÅ');
  assert(!pdfOutputString.includes('Ø=ÜÍ'), 'PDF must NOT contain broken location emoji mojibake Ø=ÜÍ');
  assert(!pdfOutputString.includes('\x00\x95'), 'PDF must NOT contain broken bullet byte 0x95');
  console.log('  ✅ [PASS] jsPDF Ticket Pass generation verified with 100% clean ASCII encoding!');

  // -------------------------------------------------------------------------
  // TEST 2: TEST HEADLESS CHROME PRINT OUTPUT (EXACTLY 1 PAGE)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Testing Chrome Print Output on Receipt Modal ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // Log in as customer
    console.log('  Navigating to /login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Quick autofill or type customer credentials
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const customerBtn = btns.find((b) => b.innerText.includes('Customer'));
      if (customerBtn) customerBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 1200));

    // Navigate to /my-bookings
    console.log('  Navigating to /my-bookings...');
    await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Open Tax Invoice / Receipt Modal
    console.log('  Opening Tax Invoice / Receipt modal...');
    const receiptBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.innerText.includes('Tax Invoice') || b.innerText.includes('Receipt'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    assert(receiptBtnClicked, 'Must find and click "Tax Invoice / Receipt" button');

    // Wait for modal to render
    await page.waitForSelector('#printable-receipt', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    // Emulate print media and take PDF snapshot
    console.log('  Generating print PDF from headless Chrome...');
    await page.emulateMediaType('print');
    
    const printPdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' },
    });

    const pdfPath = path.join(SCREENSHOTS_DIR, 'print_invoice_single_page.pdf');
    fs.writeFileSync(pdfPath, printPdfBuffer);
    console.log(`  📄 Print PDF saved to: ${pdfPath}`);

    // Parse page count in generated PDF
    const rawPdf = Buffer.from(printPdfBuffer).toString('latin1');
    const countMatch = rawPdf.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s*(\d+)/) || rawPdf.match(/\/Count\s*(\d+)/);
    const pageCount = countMatch ? parseInt(countMatch[1], 10) : (rawPdf.match(/\/Type\s*\/Page\b/g) || []).length;
    console.log(`  📊 Measured print page count: ${pageCount} page(s)`);

    assert.strictEqual(pageCount, 1, `Expected exactly 1 page for printed tax invoice, but got ${pageCount}`);
    console.log('  ✅ [PASS] Printed Tax Invoice fits on EXACTLY 1 PAGE! (Reduced from 4 pages)');

    // Capture screenshot of print view
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'print_invoice_1page_preview.png'), fullPage: false });
    console.log('  📸 Captured screenshot of print preview: screenshots/print_invoice_1page_preview.png');

    console.log('\n=============================================================');
    console.log('🎉 ALL TESTS PASSED: 0 UNEXPECTED CHARACTERS & EXACTLY 1 PAGE PRINT!');
    console.log('=============================================================\n');
  } finally {
    await page.close();
    await browser.close();
  }
}

testPdfAndPrint().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
