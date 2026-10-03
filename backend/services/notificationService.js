const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const Notification = require('../models/Notification');

// Check if actual SMTP / Gmail credentials are configured in .env
const isEmailConfigured = () => {
  return Boolean(
    process.env.EMAIL_USER && 
    process.env.EMAIL_PASS && 
    !process.env.EMAIL_USER.includes('your_email') &&
    process.env.EMAIL_USER !== 'disabled'
  );
};

let transporter = null;
const getTransporter = () => {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
      },
    });
  }
  return transporter;
};

const SUBJECT_LINES = {
  BOOKING_CONFIRMATION: '🎟️ Your EventHub Booking is Confirmed!',
  EVENT_REMINDER: '⏰ Reminder: Your Event is Coming Up Soon',
  EVENT_UPDATE: '📢 Important Update: An Event You Booked Has Changed',
  PAYMENT_FAILED: '⚠️ Payment Authorization Failed for Your Booking',
  DRAW_RESULT: '🎉 Lucky Draw Result: You Won a Promotional Prize!',
};

// Generates a responsive HTML email template with EventHub branding
const generateEmailHtml = ({ title, message, user, booking, qrImageSrc }) => {
  const eventName = booking?.event?.eventName || 'Your Event Experience';
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #090d16; color: #f1f5f9; padding: 32px 16px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Event<span style="color: #c7d2fe;">Hub</span></h1>
          <p style="margin: 4px 0 0 0; color: #e0e7ff; font-size: 13px;">Official Ticketing & Access Notification</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px; font-weight: 700;">${title}</h2>
          <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">Hello ${user?.name || 'Attendee'},</p>
          <div style="background-color: #1e293b; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0; color: #e2e8f0; font-size: 14px; line-height: 1.5;">${message}</p>
          </div>

          ${booking ? `
            <div style="background-color: #090d16; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Event:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #ffffff; text-align: right;">${eventName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Tickets:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #ffffff; text-align: right;">${booking.ticketCount || 1} Passes</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Booking Time:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #ffffff; text-align: right;">${booking.bookingTime || (booking.createdAt ? new Date(booking.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A')}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Status:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #34d399; text-align: right;">${booking.bookingStatus || 'CONFIRMED'}</td>
                </tr>
              </table>
            </div>

            ${(qrImageSrc || booking.qrCode) ? `
              <div style="text-align: center; margin: 24px 0;">
                <a href="http://localhost:5173/my-bookings" target="_blank" style="text-decoration: none; display: inline-block;">
                  <div style="display: inline-block; background-color: #ffffff; padding: 18px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); text-align: center;">
                    <img src="${qrImageSrc || booking.qrCode}" alt="Entry Gate QR Code" width="160" height="160" style="display: block; margin: 0 auto; border: 0; width: 160px; height: 160px;" />
                    <p style="margin: 10px 0 0 0; color: #0f172a; font-family: 'Courier New', Courier, monospace; font-size: 13px; font-weight: 800; letter-spacing: 1.5px;">
                      #BKG-${(booking._id || '').toString().slice(-6).toUpperCase()}
                    </p>
                  </div>
                </a>
                <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0 0;">
                  Scan this QR pass at the entrance gate for instant admission.
                </p>
              </div>
            ` : ''}
          ` : ''}

          <div style="text-align: center; margin-top: 28px;">
            <a href="http://localhost:5173/my-bookings" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: bold;">
              View Pass in Wallet
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #090d16; border-top: 1px solid #1e293b; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
          This is an automated notification from EventHub. Fast-track entry QR codes are available in your portal.
        </div>

      </div>
    </div>
  `;
};

// Creates a Notification record and dispatches email (via real SMTP or dev preview logger)
const sendEmailNotification = async ({ user, booking, type, message }) => {
  const notification = await Notification.create({
    user: user._id,
    booking: booking ? booking._id : undefined,
    type,
    message,
    channel: 'EMAIL',
    status: 'PENDING',
  });

  const subject = SUBJECT_LINES[type] || 'EventHub Notification';

  // Generate QR Code PNG buffer and inline CID attachment for Gmail / Outlook
  let qrBuffer = null;
  const qrValue = booking ? (booking._id || booking.bookingId || '').toString() : null;

  if (qrValue) {
    try {
      qrBuffer = await QRCode.toBuffer(qrValue, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 320,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (e) {
      if (booking.qrCode && booking.qrCode.startsWith('data:image/')) {
        const base64Part = booking.qrCode.split(',')[1];
        if (base64Part) qrBuffer = Buffer.from(base64Part, 'base64');
      }
    }
  }

  const attachments = [];
  let qrImageSrc = '';

  if (qrBuffer) {
    const qrCid = `ticket_qr_${qrValue.slice(-6).toLowerCase()}@eventhub`;
    attachments.push({
      filename: `ticket-pass-${qrValue.slice(-6).toUpperCase()}.png`,
      content: qrBuffer,
      cid: qrCid,
      contentType: 'image/png',
      contentDisposition: 'inline',
    });
    // In email HTML, cid: is natively rendered by Gmail, Apple Mail, Outlook without blocking base64
    qrImageSrc = `cid:${qrCid}`;
  } else if (booking?.qrCode) {
    qrImageSrc = booking.qrCode;
  }

  const htmlContent = generateEmailHtml({ title: subject, message, user, booking, qrImageSrc });

  if (isEmailConfigured()) {
    try {
      const info = await getTransporter().sendMail({
        from: `EventHub Notifications <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject,
        text: message,
        html: htmlContent,
        attachments,
      });

      notification.status = 'SENT';
      notification.providerResponseId = info.messageId;
      await notification.save();
      console.log(`[EMAIL DISPATCHED VIA GMAIL]: To ${user.email} (ID: ${info.messageId}) with inline QR code`);
    } catch (err) {
      notification.status = 'FAILED';
      await notification.save();
      console.error(`[EMAIL SMTP FAILED] (${type} to ${user.email}):`, err.message);
    }
  } else {
    // Development / Sandbox mode: Log preview cleanly and mark status as SENT
    notification.status = 'SENT';
    notification.providerResponseId = `dev_sim_${Date.now()}`;
    await notification.save();

    console.log('\n======================================================');
    console.log('✉️  [SIMULATED EMAIL DISPATCH - DEV PREVIEW]');
    console.log(`   To: ${user.email}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Message: ${message}`);
    console.log('   Status: DELIVERED (Saved to Notification Center)');
    console.log('   Tip: Set EMAIL_USER & EMAIL_PASS in backend/.env for real inbox delivery');
    console.log('======================================================\n');
  }

  return notification;
};

module.exports = { sendEmailNotification, isEmailConfigured };