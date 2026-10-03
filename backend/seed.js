const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

const User = require('./models/User');
const Event = require('./models/Event');
const Booking = require('./models/Booking');
const Payment = require('./models/Payment');
const Receipt = require('./models/Receipt');
const RewardDraw = require('./models/RewardDraw');
const Notification = require('./models/Notification');
const Voucher = require('./models/Voucher');

const seedDB = async () => {
  try {
    console.log('Connecting to MongoDB Atlas for fresh database seeding...');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ Connected to MongoDB Atlas successfully');

    // 1. Clear all existing collections
    await Promise.all([
      User.deleteMany({}),
      Event.deleteMany({}),
      Booking.deleteMany({}),
      Payment.deleteMany({}),
      Receipt.deleteMany({}),
      RewardDraw.deleteMany({}),
      Notification.deleteMany({}),
      Voucher.deleteMany({}),
    ]);
    console.log('✅ All existing collections cleared cleanly.');

    // 2. Hash Passwords
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('admin123', salt);
    const orgPass = await bcrypt.hash('organizer123', salt);
    const custPass = await bcrypt.hash('customer123', salt);

    // 3. Create Users
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@eventhub.com',
      mobile: '9876543210',
      password: adminPass,
      role: 'ADMIN',
    });

    const organizer1 = await User.create({
      name: 'Priya Sharma (TechSphere Events)',
      email: 'organizer@eventhub.com',
      mobile: '9876543211',
      password: orgPass,
      role: 'ORGANIZER',
    });

    const organizer2 = await User.create({
      name: 'Kabir Mehta (LivePulse Productions)',
      email: 'music.org@eventhub.com',
      mobile: '9876543219',
      password: orgPass,
      role: 'ORGANIZER',
    });

    const primaryCustomer = await User.create({
      name: 'Krish Patel',
      email: 'customer@eventhub.com',
      mobile: '9876543212',
      password: custPass,
      role: 'CUSTOMER',
    });

    const attendeeUsers = await User.insertMany([
      { name: 'Rohit Sharma', email: 'rohit.sharma@example.com', mobile: '9876543213', password: custPass, role: 'CUSTOMER' },
      { name: 'Ananya Sen', email: 'ananya.sen@example.com', mobile: '9876543214', password: custPass, role: 'CUSTOMER' },
      { name: 'Vikram Mehta', email: 'vikram.mehta@example.com', mobile: '9876543215', password: custPass, role: 'CUSTOMER' },
      { name: 'Neha Kapoor', email: 'neha.kapoor@example.com', mobile: '9876543216', password: custPass, role: 'CUSTOMER' },
      { name: 'Arjun Verma', email: 'arjun.verma@example.com', mobile: '9876543217', password: custPass, role: 'CUSTOMER' },
      { name: 'Pooja Iyer', email: 'pooja.iyer@example.com', mobile: '9876543218', password: custPass, role: 'CUSTOMER' },
    ]);

    console.log(`✅ Seeded 9 users (1 Admin, 2 Organizers, 7 Customers).`);

    // Helper for Future Dates
    const now = new Date();
    const futureDate = (daysAhead) => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysAhead);
      return d;
    };

    // 4. Create Events with Multi-Tier Passes
    const eventsData = [
      {
        eventName: 'NextGen AI & Cloud Architecture Summit 2026',
        category: 'Technology',
        venue: 'Grand Tech Pavilion, SG Highway, Ahmedabad',
        date: futureDate(14),
        time: '10:00',
        endTime: '18:00',
        ticketPrice: 999,
        totalSeats: 160,
        availableSeats: 157, // 3 booked
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Join industry pioneers, AI researchers, and cloud architects for intensive keynotes, hands-on architectural workshops, and executive networking sessions.',
        ticketTiers: [
          { tierName: 'Standard Pass', price: 999, totalSeats: 100, availableSeats: 98, perks: 'Main Stage Access + Conference Lunch' },
          { tierName: 'VIP All-Access Pass', price: 1499, totalSeats: 40, availableSeats: 39, perks: 'Front Row + VIP Lounge & Speaker Meet' },
          { tierName: 'Student Pass', price: 499, totalSeats: 20, availableSeats: 20, perks: 'General Admission with Valid Student ID' },
        ],
      },
      {
        eventName: 'Neon Echoes: Live Acoustic Sunset Festival',
        category: 'Concerts',
        venue: 'Riverfront Open Amphitheater, Ahmedabad',
        date: futureDate(21),
        time: '18:30',
        endTime: '22:30',
        ticketPrice: 599,
        totalSeats: 320,
        availableSeats: 313, // 7 booked
        organizer: organizer2._id,
        status: 'ACTIVE',
        description: 'An enchanting evening of live indie-folk, unplugged melodies, and artisanal food stalls set against the stunning sunset skyline.',
        ticketTiers: [
          { tierName: 'General Lawn Pass', price: 599, totalSeats: 200, availableSeats: 195, perks: 'Lawn Standing & Food Court Access' },
          { tierName: 'Fan Pit Pass', price: 999, totalSeats: 80, availableSeats: 78, perks: 'Front Stage Zone + Festival Goodie Bag' },
          { tierName: 'VIP Lounge Pass', price: 1899, totalSeats: 40, availableSeats: 40, perks: 'Seated Canopy + Unlimited Welcome Drinks' },
        ],
      },
      {
        eventName: 'Fullstack React 19 & Tailwind CSS Masterclass',
        category: 'Workshops',
        venue: 'CodeCraft Innovation Hub, Bodakdev, Ahmedabad',
        date: futureDate(7),
        time: '14:00',
        endTime: '18:00',
        ticketPrice: 399,
        totalSeats: 50,
        availableSeats: 49,
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Comprehensive code-along covering React 19 Server Components, Actions, optimistic UI patterns, and modern responsive design using Tailwind CSS v4.',
        ticketTiers: [
          { tierName: 'Workshop Admission', price: 399, totalSeats: 40, availableSeats: 39, perks: 'Lab Workspace + Digital Certificate' },
          { tierName: 'Pro Dev Mentorship Pass', price: 799, totalSeats: 10, availableSeats: 10, perks: '1-on-1 Code Review + Lifetime Slides' },
        ],
      },
      {
        eventName: 'Global Founders & Seed Investors Mixer',
        category: 'Networking',
        venue: 'Skyline Club & Terrace Lounge, Satellite, Ahmedabad',
        date: futureDate(28),
        time: '19:00',
        endTime: '22:00',
        ticketPrice: 1299,
        totalSeats: 80,
        availableSeats: 79,
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'High-impact networking evening connecting high-growth early-stage startups with angel networks, venture syndicates, and ecosystem leaders.',
        ticketTiers: [
          { tierName: 'Founder Pass', price: 1299, totalSeats: 50, availableSeats: 49, perks: 'Access to Pitch Circle + Canapés' },
          { tierName: 'Investor Table Pass', price: 2499, totalSeats: 30, availableSeats: 30, perks: 'Private Lounge Access + Deal Directory' },
        ],
      },
      {
        eventName: 'Inter-City Badminton League Championship',
        category: 'Sports',
        venue: 'Apex Indoor Sports Complex, Memnagar, Ahmedabad',
        date: futureDate(10),
        time: '09:00',
        endTime: '17:00',
        ticketPrice: 249,
        totalSeats: 120,
        availableSeats: 120,
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Electrifying state-level tournament featuring singles and doubles matchups across junior and master divisions.',
        ticketTiers: [
          { tierName: 'Spectator Gallery Pass', price: 249, totalSeats: 100, availableSeats: 100, perks: 'Court-view grandstand seating' },
          { tierName: 'Courtside VIP Pass', price: 499, totalSeats: 20, availableSeats: 20, perks: 'Center court seating + Event kit' },
        ],
      },
      {
        eventName: 'CyberSecurity DefCamp & Ethical Hacking Forum',
        category: 'Technology',
        venue: 'Nasscom Startup Arena, Whitefield, Bengaluru',
        date: futureDate(35),
        time: '09:30',
        endTime: '17:30',
        ticketPrice: 899,
        totalSeats: 120,
        availableSeats: 120,
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Deep dive into zero-trust architectures, cloud security posture, live capture-the-flag (CTF) challenges, and red-teaming methodologies.',
        ticketTiers: [
          { tierName: 'Standard Delegate', price: 899, totalSeats: 90, availableSeats: 90, perks: 'Keynotes + CTF arena spectator' },
          { tierName: 'CTF Competitor Pass', price: 1499, totalSeats: 30, availableSeats: 30, perks: 'Active CTF slot + DefCamp badge' },
        ],
      },
      {
        eventName: 'Indie Rock Under the Stars',
        category: 'Concerts',
        venue: 'Bandra Seaside Fort, Bandra West, Mumbai',
        date: futureDate(18),
        time: '19:00',
        endTime: '23:00',
        ticketPrice: 699,
        totalSeats: 250,
        availableSeats: 250,
        organizer: organizer2._id,
        status: 'ACTIVE',
        description: 'An open-air musical evening by the Arabian Sea featuring homegrown alternative rock bands, food trucks, and art installations.',
        ticketTiers: [
          { tierName: 'Standing Arena Pass', price: 699, totalSeats: 200, availableSeats: 200, perks: 'General field standing' },
          { tierName: 'VIP Elevated Deck', price: 1299, totalSeats: 50, availableSeats: 50, perks: 'Rooftop viewing deck + Express Bar' },
        ],
      },
      {
        eventName: 'Design Systems & Micro-Interactions Bootcamp',
        category: 'Workshops',
        venue: 'Viman Nagar Creative Studio, Pune',
        date: futureDate(25),
        time: '11:00',
        endTime: '16:00',
        ticketPrice: 449,
        totalSeats: 50,
        availableSeats: 50,
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Practical Figma-to-Code workflow workshop exploring design tokens, fluid typography, atomic components, and Framer Motion micro-animations.',
        ticketTiers: [
          { tierName: 'Standard Workshop Seat', price: 449, totalSeats: 40, availableSeats: 40, perks: 'Lab access + UI starter kit' },
          { tierName: 'Portfolio Review Pass', price: 899, totalSeats: 10, availableSeats: 10, perks: 'Live portfolio critique by Design Lead' },
        ],
      },
    ];

    const createdEvents = await Event.insertMany(eventsData);
    console.log(`✅ Seeded ${createdEvents.length} events with complete multi-tier ticketing.`);

    const aiEvent = createdEvents[0];
    const concertEvent = createdEvents[1];
    const workshopEvent = createdEvents[2];
    const networkingEvent = createdEvents[3];

    // 5. Seed Bookings, QR Codes, Payments, and Receipts
    const generateQr = async (id) => {
      try {
        return await QRCode.toDataURL(id.toString(), {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 320,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch {
        return null;
      }
    };

    // Booking 1: Confirmed booking for Krish Patel on AI Summit
    const bkg1Id = new mongoose.Types.ObjectId();
    const qr1 = await generateQr(bkg1Id);
    const bkg1 = await Booking.create({
      _id: bkg1Id,
      user: primaryCustomer._id,
      event: aiEvent._id,
      tierName: 'VIP All-Access Pass',
      ticketCount: 1,
      unitPrice: 1499,
      subtotal: 1499,
      platformFee: 75,
      totalAmount: 1574,
      bookingStatus: 'CONFIRMED',
      bookingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      bookingTime: '02:30 PM',
      isPromotional: false,
      qrCode: qr1,
    });

    const pay1 = await Payment.create({
      booking: bkg1._id,
      amount: bkg1.totalAmount,
      razorpayOrderId: 'order_seed_krish_01',
      transactionId: 'pay_krish_ai_99182',
      paymentMethod: 'UPI',
      paymentStatus: 'SUCCESS',
    });

    await Receipt.create({
      payment: pay1._id,
      amount: pay1.amount,
      generatedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    // Booking 2: Active PENDING booking for Krish Patel (with live 10-minute hold!)
    const bkg2Id = new mongoose.Types.ObjectId();
    const qr2 = await generateQr(bkg2Id);
    const bkg2 = await Booking.create({
      _id: bkg2Id,
      user: primaryCustomer._id,
      event: concertEvent._id,
      tierName: 'General Lawn Pass',
      ticketCount: 1,
      unitPrice: 599,
      subtotal: 599,
      platformFee: 30,
      totalAmount: 629,
      bookingStatus: 'PENDING',
      expiresAt: new Date(Date.now() + 9 * 60 * 1000 + 50 * 1000), // ~9m 50s left
      bookingDate: new Date(),
      bookingTime: '05:40 PM',
      isPromotional: false,
      qrCode: qr2,
    });

    // Booking 3: Cancelled booking for Krish Patel (with full refund info)
    const bkg3Id = new mongoose.Types.ObjectId();
    await Booking.create({
      _id: bkg3Id,
      user: primaryCustomer._id,
      event: workshopEvent._id,
      tierName: 'Workshop Admission',
      ticketCount: 1,
      unitPrice: 399,
      subtotal: 399,
      platformFee: 20,
      totalAmount: 419,
      bookingStatus: 'CANCELLED',
      cancellationReason: 'Event cancelled by host / organizer',
      refundStatus: 'PROCESSED',
      bookingDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      bookingTime: '11:15 AM',
    });

    // Bookings 4+: Seed Attendee Bookings for Organizer Turnout and Analytics
    const attendeeBookings = [
      { user: attendeeUsers[0]._id, event: aiEvent._id, tier: 'Standard Pass', unitPrice: 999, ticketCount: 1, status: 'CONFIRMED', method: 'Card' },
      { user: attendeeUsers[1]._id, event: aiEvent._id, tier: 'Standard Pass', unitPrice: 999, ticketCount: 1, status: 'CONFIRMED', method: 'UPI' },
      { user: attendeeUsers[2]._id, event: concertEvent._id, tier: 'General Lawn Pass', unitPrice: 599, ticketCount: 2, status: 'CONFIRMED', method: 'Netbanking' },
      { user: attendeeUsers[3]._id, event: concertEvent._id, tier: 'Fan Pit Pass', unitPrice: 999, ticketCount: 2, status: 'CONFIRMED', method: 'UPI' },
      { user: attendeeUsers[4]._id, event: concertEvent._id, tier: 'General Lawn Pass', unitPrice: 599, ticketCount: 2, status: 'CONFIRMED', method: 'UPI' },
      { user: attendeeUsers[5]._id, event: networkingEvent._id, tier: 'Founder Pass', unitPrice: 1299, ticketCount: 1, status: 'CONFIRMED', method: 'Card' },
    ];

    for (let i = 0; i < attendeeBookings.length; i++) {
      const item = attendeeBookings[i];
      const bkgId = new mongoose.Types.ObjectId();
      const qr = await generateQr(bkgId);
      const subtotal = item.unitPrice * item.ticketCount;
      const platformFee = Math.round(subtotal * 0.05);
      const totalAmount = subtotal + platformFee;

      const bkg = await Booking.create({
        _id: bkgId,
        user: item.user,
        event: item.event,
        tierName: item.tier,
        ticketCount: item.ticketCount,
        unitPrice: item.unitPrice,
        subtotal,
        platformFee,
        totalAmount,
        bookingStatus: item.status,
        bookingDate: new Date(Date.now() - (i + 1) * 8 * 60 * 60 * 1000),
        bookingTime: '03:15 PM',
        qrCode: qr,
      });

      if (item.status === 'CONFIRMED') {
        const p = await Payment.create({
          booking: bkg._id,
          amount: totalAmount,
          razorpayOrderId: `order_seed_att_${i + 1}`,
          transactionId: `pay_seed_txn_${i + 1}_${Date.now()}`,
          paymentMethod: item.method,
          paymentStatus: 'SUCCESS',
        });
        await Receipt.create({
          payment: p._id,
          amount: p.amount,
          generatedDate: new Date(Date.now() - (i + 1) * 8 * 60 * 60 * 1000),
        });
      }
    }

    console.log('✅ Seeded customer and attendee bookings with verified payments, QR passes & receipts.');

    // 6. Seed Reward Draws / Lucky Draw Campaigns
    // Active Lucky Draw for AI Summit
    await RewardDraw.create({
      event: aiEvent._id,
      promoTicketPrice: 799,
      discountPercentage: 20,
      numberOfWinners: 2,
      participants: [primaryCustomer._id, attendeeUsers[0]._id, attendeeUsers[1]._id],
      drawStatus: 'OPEN',
      drawDate: futureDate(7),
    });

    // Completed Lucky Draw for Workshop Event
    const completedDraw = await RewardDraw.create({
      event: workshopEvent._id,
      promoTicketPrice: 319,
      discountPercentage: 20,
      numberOfWinners: 1,
      participants: [primaryCustomer._id, attendeeUsers[2]._id, attendeeUsers[3]._id],
      winners: [primaryCustomer._id],
      drawStatus: 'COMPLETED',
      drawDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    // 7. Seed Single-Use Winner Voucher for Krish Patel (Earned from Priya Sharma's Workshop)
    const winnerVoucher = await Voucher.create({
      code: 'WIN-WORK-2026',
      user: primaryCustomer._id,
      organizer: organizer1._id,
      sourceEvent: workshopEvent._id,
      rewardDraw: completedDraw._id,
      discountPercentage: 20,
      isRedeemed: false,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    console.log(`✅ Seeded RewardDraw campaigns and Winner Voucher (${winnerVoucher.code}) for Krish Patel.`);

    // 8. Seed In-App Notifications for Krish Patel
    const notificationsData = [
      {
        user: primaryCustomer._id,
        booking: bkg1._id,
        type: 'BOOKING_CONFIRMATION',
        message: 'Your VIP pass for "NextGen AI & Cloud Architecture Summit 2026" has been confirmed! Fast-track QR pass is unlocked in your wallet.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        user: primaryCustomer._id,
        booking: bkg2._id,
        type: 'EVENT_REMINDER',
        message: 'Seats held! Complete your checkout for "Neon Echoes: Live Acoustic Sunset Festival" before the 10-minute hold expires.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        user: primaryCustomer._id,
        type: 'DRAW_RESULT',
        message: '🎉 Congratulations! You won the Lucky Draw for "Fullstack React 19 & Tailwind CSS Masterclass"! Host "Priya Sharma (TechSphere Events)" has awarded you an exclusive 20% discount voucher on your next booking: WIN-WORK-2026.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        user: primaryCustomer._id,
        type: 'EVENT_UPDATE',
        message: 'Organizer Note: Entry gates for "NextGen AI Summit" will open at 09:15 AM sharp with express badge scanning available.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 36 * 60 * 1000),
      },
    ];

    await Notification.insertMany(notificationsData);
    console.log(`✅ Seeded ${notificationsData.length} in-app notifications.`);

    console.log('\n======================================================');
    console.log('🎉 FRESH DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('Available Login Credentials:');
    console.log('1. Admin:     admin@eventhub.com     / admin123');
    console.log('2. Organizer: organizer@eventhub.com / organizer123');
    console.log('3. Organizer: music.org@eventhub.com / organizer123');
    console.log('4. Customer:  customer@eventhub.com  / customer123  (Krish Patel)');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedDB();
