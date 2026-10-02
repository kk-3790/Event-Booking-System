import { jsPDF } from 'jspdf';

/**
 * Generates and downloads an official high-resolution EventHub Ticket Pass PDF
 * @param {Object} options
 * @param {Object} options.booking - The booking document
 * @param {Object} options.event - The event document
 * @param {Object} options.user - The user/attendee details
 * @param {string} options.qrCodeDataUrl - Base64 PNG QR code data URL
 */
export const downloadTicketPdf = ({ booking, event, user, qrCodeDataUrl }) => {
  if (!booking) return;

  const ev = event || booking.event || {};
  const attendee = user || booking.user || {};
  const ticketRef = `#BKG-${(booking._id || '').slice(-6).toUpperCase()}`;
  const qrImage = qrCodeDataUrl || booking.qrCode;

  // Modern Ticket Card size: 105mm x 180mm (fits mobile screens & prints neatly)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [105, 180],
  });

  const pageWidth = 105;
  const pageHeight = 180;

  // Background - Deep midnight luxury tone
  doc.setFillColor(10, 15, 29); // #0a0f1d
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative Top Accent Gradient Bar
  doc.setFillColor(99, 102, 241); // Indigo-500
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(6, 8, pageWidth - 12, 18, 3, 3, 'F');

  // EventHub Branding
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Event', 12, 19);
  doc.setTextColor(129, 140, 248); // Indigo-400
  doc.text('Hub', 26, 19);

  // Subtitle badge
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 211, 153); // Emerald-400
  doc.text('OFFICIAL GATE ADMISSION PASS', pageWidth - 12, 16, { align: 'right' });
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.setFont('helvetica', 'normal');
  doc.text(`PASS ID: ${ticketRef}`, pageWidth - 12, 21, { align: 'right' });

  // Main Event Card Section
  doc.setFillColor(20, 27, 45); // Slate-850
  doc.roundedRect(6, 30, pageWidth - 12, 44, 3, 3, 'F');

  // Pass Tier Pill Badge
  const tierName = (booking.tierName || 'GENERAL ADMISSION').toUpperCase();
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.roundedRect(11, 35, 36, 6, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(tierName, 29, 39.2, { align: 'center' });

  // Event Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const eventName = ev.eventName || 'Live Event Experience';
  const splitTitle = doc.splitTextToSize(eventName, pageWidth - 24);
  doc.text(splitTitle, 11, 47);

  // Event Date, Time, Venue
  const formattedDate = ev.date
    ? new Date(ev.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date TBD';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(129, 140, 248); // Indigo-400
  doc.text('DATE & TIME:', 11, 56);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // Slate-200
  doc.text(`${formattedDate} ${ev.time ? `at ${ev.time}` : ''}`, 33, 56);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(129, 140, 248); // Indigo-400
  doc.text('VENUE:', 11, 62);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const venueText = ev.venue || 'Venue Address To Be Announced';
  const splitVenue = doc.splitTextToSize(venueText, pageWidth - 36);
  doc.text(splitVenue, 26, 62);

  // Perforated Tear / Cut Divider Line with Notch Cutouts
  const tearY = 79;
  // Left notch circle
  doc.setFillColor(10, 15, 29);
  doc.circle(6, tearY, 4, 'F');
  // Right notch circle
  doc.circle(pageWidth - 6, tearY, 4, 'F');
  // Dashed line
  doc.setDrawColor(71, 85, 105);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(13, tearY, pageWidth - 13, tearY);
  doc.setLineDashPattern([], 0); // reset

  // Attendee & Booking Details Box
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(6, 84, pageWidth - 12, 28, 3, 3, 'F');

  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PRIMARY ATTENDEE', 12, 90);
  doc.text('PASS QUANTITY', 60, 90);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(attendee.name || 'Pass Holder', 12, 95);
  const passQty = booking.ticketCount || 1;
  doc.text(`${passQty} ${passQty === 1 ? 'Ticket' : 'Tickets'}`, 60, 95);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('BOOKED TIME', 12, 103);
  doc.text('TOTAL AMOUNT', 60, 103);

  const bookTime = booking.bookingTime || (booking.createdAt ? new Date(booking.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Confirmed');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(bookTime, 12, 108);

  const total = booking.totalAmount || ((ev.ticketPrice || 0) * (booking.ticketCount || 1));
  doc.setTextColor(52, 211, 153);
  doc.text(`INR ${total.toLocaleString('en-IN')}`, 60, 108);

  // QR Code Pass Section
  const qrBoxY = 114;
  const qrBoxW = 54;
  const qrBoxH = 52;
  const qrBoxX = (pageWidth - qrBoxW) / 2; // 25.5 mm
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 4, 4, 'F');

  if (qrImage) {
    try {
      const qrSize = 36; // 36mm x 36mm
      const qrX = (pageWidth - qrSize) / 2; // 34.5 mm
      const qrY = qrBoxY + 3; // 117 mm
      doc.addImage(qrImage, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      // fallback if image fail
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('PASS QR CODE', 52.5, qrBoxY + 22, { align: 'center' });
    }
  }

  // Ref Code below QR with 7mm clear vertical separation (NO overlap)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(ticketRef, 52.5, qrBoxY + 46, { align: 'center' });

  // Security Footer Notes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Present this QR code at the entrance turnstile for express gate check-in.', 52.5, 171, { align: 'center' });
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(5.5);
  doc.text('Verified Genuine Pass | 256-bit Encrypted Token | Powered by EventHub', 52.5, 175, { align: 'center' });

  // Sanitize filename
  const cleanEventName = (ev.eventName || 'Event').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const cleanRef = (booking._id || '').slice(-6).toUpperCase();
  const filename = `Ticket_${cleanEventName}_BKG-${cleanRef}.pdf`;

  // Download PDF
  doc.save(filename);
};

/**
 * Downloads the QR code as a high-resolution PNG image pass
 * with reference code positioned cleanly below the QR matrix
 */
export const downloadQrImage = ({ booking, event, qrCodeDataUrl }) => {
  const qr = qrCodeDataUrl || booking?.qrCode;
  if (!qr) return;

  const ev = event || booking?.event || {};
  const cleanEventName = (ev.eventName || 'Event').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const cleanRef = (booking?._id || '').slice(-6).toUpperCase();
  const ticketRef = `#BKG-${cleanRef}`;
  const filename = `QR_Pass_${cleanEventName}_BKG-${cleanRef}.png`;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 440;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');

    // Clean white card background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Event title & badge
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL GATE ENTRY PASS', 220, 38);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const title = (ev.eventName || 'Event Pass').slice(0, 32);
    ctx.fillText(title, 220, 68);

    // Load QR image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw QR centered: 300x300, starting at Y=85, ends at Y=385
      ctx.drawImage(img, 70, 85, 300, 300);

      // Reference text well below QR: Y=430 (45px gap, zero overlap)
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px monospace, Courier, sans-serif';
      ctx.fillText(ticketRef, 220, 430);

      ctx.fillStyle = '#64748b';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Scan at entrance gate | EventHub Verified Pass', 220, 475);

      const brandedPng = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = brandedPng;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.onerror = () => {
      const link = document.createElement('a');
      link.href = qr;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = qr;
  } catch (err) {
    const link = document.createElement('a');
    link.href = qr;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
