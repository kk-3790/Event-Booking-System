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
const { calculateEndTime } = require('./utils/eventTiming');

const seedDB = async () => {
  try {
    console.log('Connecting to MongoDB Atlas for fresh database seeding...');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB Atlas successfully.');

    // 1. Clear all existing data
    console.log('🧹 Clearing all collections...');
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
    console.log('✅ Database wiped completely clean.');

    // 2. Hash Passwords
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('admin123', salt);
    const orgPass = await bcrypt.hash('organizer123', salt);
    const custPass = await bcrypt.hash('customer123', salt);

    // 3. Seed Users
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

    console.log(`✅ Seeded 10 verified users (1 Admin, 2 Organizers, 7 Customers).`);

    // Date Helpers
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = (daysAhead) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysAhead);
      return d;
    };

    // 4. Seed 12 Diverse Events across Categories with Local High-Res Banner Images & Durations
    const eventsData = [
      {
        eventName: 'NextGen AI & Cloud Architecture Summit 2026',
        category: 'Technology',
        venue: 'Grand Tech Pavilion, SG Highway, Ahmedabad',
        date: today, // Today's event! Perfect for testing live gate scanner!
        time: '09:00',
        duration: 9,
        endTime: calculateEndTime('09:00', 9),
        ticketPrice: 999,
        totalSeats: 160,
        availableSeats: 156, // 4 booked
        bannerImage: '/uploads/banners/banner-ai-summit.jpg',
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Join industry pioneers, AI researchers, and cloud architects for intensive keynotes, hands-on architectural workshops, and executive networking sessions.',
        ticketTiers: [
          { tierName: 'Standard Pass', price: 999, totalSeats: 100, availableSeats: 98, perks: 'Main Stage Access + Conference Lunch' },
          { tierName: 'VIP All-Access Pass', price: 1499, totalSeats: 40, availableSeats: 38, perks: 'Front Row + VIP Lounge & Speaker Meet' },
          { tierName: 'Student Pass', price: 499, totalSeats: 20, availableSeats: 20, perks: 'General Admission with Valid Student ID' },
        ],
      },
      {
        eventName: 'Neon Echoes: Live Acoustic Sunset Festival',
        category: 'Concerts',
        venue: 'Riverfront Open Amphitheater, Ahmedabad',
        date: futureDate(7),
        time: '18:00',
        duration: 4.5,
        endTime: calculateEndTime('18:00', 4.5),
        ticketPrice: 599,
        totalSeats: 320,
        availableSeats: 315, // 5 booked
        bannerImage: '/uploads/banners/banner-neon-echoes.jpg',
        organizer: organizer2._id,
        status: 'ACTIVE',
        description: 'An enchanting evening of live indie-folk, unplugged melodies, and artisanal food stalls set against the stunning sunset skyline.',
        ticketTiers: [
          { tierName: 'General Lawn Pass', price: 599, totalSeats: 200, availableSeats: 196, perks: 'Lawn Standing & Food Court Access' },
          { tierName: 'Fan Pit Pass', price: 999, totalSeats: 80, availableSeats: 79, perks: 'Front Stage Zone + Festival Goodie Bag' },
          { tierName: 'VIP Lounge Pass', price: 1899, totalSeats: 40, availableSeats: 40, perks: 'Seated Canopy + Unlimited Welcome Drinks' },
        ],
      },
      {
        eventName: 'Fullstack React 19 & Tailwind CSS Masterclass',
        category: 'Workshops',
        venue: 'CodeCraft Innovation Hub, Bodakdev, Ahmedabad',
        date: futureDate(14),
        time: '14:00',
        duration: 4,
        endTime: calculateEndTime('14:00', 4),
        ticketPrice: 399,
        totalSeats: 50,
        availableSeats: 49, // 1 booked
        bannerImage: '/uploads/banners/banner-react-workshop.jpg',
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
        date: futureDate(21),
        time: '19:00',
        duration: 3.5,
        endTime: calculateEndTime('19:00', 3.5),
        ticketPrice: 1299,
        totalSeats: 80,
        availableSeats: 79, // 1 booked
        bannerImage: '/uploads/banners/banner-founders-mixer.jpg',
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
        duration: 8,
        endTime: calculateEndTime('09:00', 8),
        ticketPrice: 249,
        totalSeats: 120,
        availableSeats: 120,
        bannerImage: '/uploads/banners/banner-badminton-championship.jpg',
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
        date: futureDate(28),
        time: '09:30',
        duration: 8,
        endTime: calculateEndTime('09:30', 8),
        ticketPrice: 899,
        totalSeats: 120,
        availableSeats: 120,
        bannerImage: '/uploads/banners/banner-cybersecurity-defcamp.jpg',
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Deep dive into zero-trust architectures, cloud security posture, live capture-the-flag (CTF) challenges, and red-teaming methodologies.',
        ticketTiers: [
          { tierName: 'Standard Delegate', price: 899, totalSeats: 90, availableSeats: 90, perks: 'Keynotes + CTF arena spectator' },
          { tierName: 'CTF Competitor Pass', price: 1499, totalSeats: 30, availableSeats: 30, perks: 'Active CTF slot + DefCamp badge' },
        ],
      },
      {
        eventName: 'Indie Rock Under the Stars: Mumbai Seaside',
        category: 'Concerts',
        venue: 'Bandra Seaside Fort, Bandra West, Mumbai',
        date: futureDate(18),
        time: '19:00',
        duration: 4,
        endTime: calculateEndTime('19:00', 4),
        ticketPrice: 699,
        totalSeats: 250,
        availableSeats: 250,
        bannerImage: '/uploads/banners/banner-indie-rock.jpg',
        organizer: organizer2._id,
        status: 'ACTIVE',
        description: 'An open-air musical evening by the Arabian Sea featuring homegrown alternative rock bands, food trucks, and visual art installations.',
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
        duration: 5,
        endTime: calculateEndTime('11:00', 5),
        ticketPrice: 449,
        totalSeats: 50,
        availableSeats: 50,
        bannerImage: '/uploads/banners/banner-design-bootcamp.jpg',
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'Practical Figma-to-Code workflow workshop exploring design tokens, fluid typography, atomic components, and Framer Motion micro-animations.',
        ticketTiers: [
          { tierName: 'Standard Workshop Seat', price: 449, totalSeats: 40, availableSeats: 40, perks: 'Lab access + UI starter kit' },
          { tierName: 'Portfolio Review Pass', price: 899, totalSeats: 10, availableSeats: 10, perks: 'Live portfolio critique by Design Lead' },
        ],
      },
      {
        eventName: 'Late Night Standup Comedy Special: Uncensored',
        category: 'Comedy',
        venue: 'The Laugh Store, CyberHub, Gurugram',
        date: futureDate(12),
        time: '20:30',
        duration: 2.5,
        endTime: calculateEndTime('20:30', 2.5),
        ticketPrice: 499,
        totalSeats: 150,
        availableSeats: 150,
        bannerImage: '/uploads/banners/banner-comedy-night.jpg',
        organizer: organizer2._id,
        status: 'ACTIVE',
        description: 'Non-stop laughter with India’s top viral standup comedians delivering raw, unfiltered sets, crowd work, and hilarious anecdotes.',
        ticketTiers: [
          { tierName: 'General Seating Pass', price: 499, totalSeats: 110, availableSeats: 110, perks: 'Standard auditorium seating' },
          { tierName: 'Front Row Splash Zone', price: 899, totalSeats: 40, availableSeats: 40, perks: 'Front 2 rows + Meet & greet with comics' },
        ],
      },
      {
        eventName: 'Artisanal Food & Craft Beer Fiesta 2026',
        category: 'Food & Drinks',
        venue: 'Jawaharlal Nehru Stadium Lawns, New Delhi',
        date: futureDate(16),
        time: '12:00',
        duration: 10,
        endTime: calculateEndTime('12:00', 10),
        ticketPrice: 299,
        totalSeats: 400,
        availableSeats: 400,
        bannerImage: '/uploads/banners/banner-gourmet-fiesta.jpg',
        organizer: organizer2._id,
        status: 'ACTIVE',
        description: 'A culinary carnival featuring 50+ regional chefs, wood-fired pizzas, gourmet desserts, craft breweries, and live acoustic buskers.',
        ticketTiers: [
          { tierName: 'Carnival Entry Pass', price: 299, totalSeats: 300, availableSeats: 300, perks: 'Entry to all food streets & live stage' },
          { tierName: 'Tasting Passport Pass', price: 799, totalSeats: 100, availableSeats: 100, perks: 'Entry + 5 Craft Beverage Tasting Coupons' },
        ],
      },
      {
        eventName: 'National Valorant Championship & LAN Party',
        category: 'Gaming',
        venue: 'Phoenix Marketcity Convention Arena, Kurla, Mumbai',
        date: futureDate(30),
        time: '10:00',
        duration: 12,
        endTime: calculateEndTime('10:00', 12),
        ticketPrice: 349,
        totalSeats: 300,
        availableSeats: 300,
        bannerImage: '/uploads/banners/banner-esports-arena.jpg',
        organizer: organizer1._id,
        status: 'ACTIVE',
        description: 'High-stakes LAN finals featuring the top 16 esports rosters competing for a ₹10,00,000 prize pool, cosplay runway, and public gaming booths.',
        ticketTiers: [
          { tierName: 'Spectator Pass', price: 349, totalSeats: 250, availableSeats: 250, perks: 'Main arena seating + Cosplay showcase' },
          { tierName: 'LAN Competitor / VIP', price: 799, totalSeats: 50, availableSeats: 50, perks: 'Reserved LAN rig + Player Lounge access' },
        ],
      },
      {
        eventName: 'Metamorphosis: Modern Art & Light Biennial',
        category: 'Art & Culture',
        venue: 'Kala Ghoda Heritage Precinct, Fort, Mumbai',
        date: futureDate(35),
        time: '16:00',
        duration: 6,
        endTime: calculateEndTime('16:00', 6),
        ticketPrice: 199,
        totalSeats: 200,
        availableSeats: 200,
        bannerImage: '/uploads/banners/banner-art-gala.jpg',
        organizer: organizer2._id,
        status: 'ACTIVE',
        description: 'Immersive light installations, digital generative art, sculpture galleries, and interactive projections by contemporary Asian artists.',
        ticketTiers: [
          { tierName: 'Biennial Day Pass', price: 199, totalSeats: 160, availableSeats: 160, perks: 'Access to all indoor & courtyard galleries' },
          { tierName: 'Curator Tour VIP Pass', price: 499, totalSeats: 40, availableSeats: 40, perks: 'Guided tour by lead curator + Exhibition catalog' },
        ],
      },
    ];

    const createdEvents = await Event.insertMany(eventsData);
    console.log(`✅ Seeded ${createdEvents.length} events with verified local banner images and durations.`);

    const todayAiEvent = createdEvents[0];
    const concertEvent = createdEvents[1];
    const workshopEvent = createdEvents[2];
    const networkingEvent = createdEvents[3];

    // 5. Seed QR Codes & Bookings
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

    // Booking 1: Confirmed VIP Pass for Krish Patel on Today's AI Summit
    // (Checked-In = false -> Ready for Gate Scanner test!)
    const bkg1Id = new mongoose.Types.ObjectId();
    const qr1 = await generateQr(bkg1Id);
    const bkg1 = await Booking.create({
      _id: bkg1Id,
      user: primaryCustomer._id,
      event: todayAiEvent._id,
      tierName: 'VIP All-Access Pass',
      ticketCount: 1,
      unitPrice: 1499,
      subtotal: 1499,
      platformFee: 75,
      totalAmount: 1574,
      bookingStatus: 'CONFIRMED',
      bookingDate: new Date(),
      bookingTime: '08:45 AM',
      checkedIn: false, // Ready to scan!
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
      generatedDate: new Date(),
    });

    // Booking 2: Active PENDING booking for Krish Patel on Concert (with live 10-minute hold!)
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
      expiresAt: new Date(Date.now() + 9 * 60 * 1000 + 45 * 1000), // ~9m 45s left
      bookingDate: new Date(),
      bookingTime: '09:55 AM',
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
      cancellationReason: 'Event schedule adjusted by host / organizer',
      refundStatus: 'PROCESSED',
      bookingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      bookingTime: '11:15 AM',
    });

    // Bookings 4 to 8: Attendee bookings for Today's AI Summit and other events
    const sampleAttendeeBookings = [
      // For Today's AI Event: 1 already checked-in, 2 waiting to be scanned at the gate!
      {
        user: attendeeUsers[0]._id,
        event: todayAiEvent._id,
        tier: 'Standard Pass',
        unitPrice: 999,
        ticketCount: 1,
        checkedIn: true,
        checkedInAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        user: attendeeUsers[1]._id,
        event: todayAiEvent._id,
        tier: 'Standard Pass',
        unitPrice: 999,
        ticketCount: 1,
        checkedIn: false, // Ready to scan!
      },
      {
        user: attendeeUsers[2]._id,
        event: todayAiEvent._id,
        tier: 'VIP All-Access Pass',
        unitPrice: 1499,
        ticketCount: 1,
        checkedIn: false, // Ready to scan!
      },
      // For Concert Event
      {
        user: attendeeUsers[3]._id,
        event: concertEvent._id,
        tier: 'General Lawn Pass',
        unitPrice: 599,
        ticketCount: 2,
        checkedIn: false,
      },
      {
        user: attendeeUsers[4]._id,
        event: concertEvent._id,
        tier: 'Fan Pit Pass',
        unitPrice: 999,
        ticketCount: 2,
        checkedIn: false,
      },
      // For Networking Event
      {
        user: attendeeUsers[5]._id,
        event: networkingEvent._id,
        tier: 'Founder Pass',
        unitPrice: 1299,
        ticketCount: 1,
        checkedIn: false,
      },
    ];

    const gateTestTickets = [];

    for (let i = 0; i < sampleAttendeeBookings.length; i++) {
      const item = sampleAttendeeBookings[i];
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
        bookingStatus: 'CONFIRMED',
        bookingDate: new Date(Date.now() - (i + 1) * 3600 * 1000),
        bookingTime: '08:30 AM',
        checkedIn: Boolean(item.checkedIn),
        checkedInAt: item.checkedInAt || undefined,
        qrCode: qr,
      });

      const p = await Payment.create({
        booking: bkg._id,
        amount: totalAmount,
        razorpayOrderId: `order_seed_att_${i + 1}`,
        transactionId: `pay_seed_txn_${i + 1}_${Date.now()}`,
        paymentMethod: 'UPI',
        paymentStatus: 'SUCCESS',
      });

      await Receipt.create({
        payment: p._id,
        amount: p.amount,
        generatedDate: new Date(Date.now() - (i + 1) * 3600 * 1000),
      });

      if (item.event.toString() === todayAiEvent._id.toString() && !item.checkedIn) {
        gateTestTickets.push({
          bookingId: bkg._id.toString(),
          ticketRef: `#BKG-${bkg._id.toString().slice(-6).toUpperCase()}`,
        });
      }
    }

    console.log('✅ Seeded confirmed attendee bookings with QR codes and payment receipts.');

    // 6. Seed Reward Draws / Lucky Draw Campaigns
    // Active Lucky Draw for AI Summit
    await RewardDraw.create({
      event: todayAiEvent._id,
      promoTicketPrice: 799,
      discountPercentage: 20,
      numberOfWinners: 2,
      participants: [primaryCustomer._id, attendeeUsers[0]._id, attendeeUsers[1]._id],
      drawStatus: 'OPEN',
      drawDate: futureDate(5),
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

    // 7. Seed Single-Use Winner Voucher for Krish Patel
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

    console.log(`✅ Seeded Lucky Draw campaign & Winner Voucher (${winnerVoucher.code}) for Krish Patel.`);

    // 8. Seed In-App Notifications for Krish Patel
    const notificationsData = [
      {
        user: primaryCustomer._id,
        booking: bkg1._id,
        type: 'BOOKING_CONFIRMATION',
        message: 'Your VIP pass for "NextGen AI & Cloud Architecture Summit 2026" is confirmed! Fast-track QR pass is ready in your wallet.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
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
        message: '🎉 Congratulations! You won the Lucky Draw for "Fullstack React 19 & Tailwind CSS Masterclass"! Host "Priya Sharma" awarded you an exclusive 20% voucher: WIN-WORK-2026.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        user: primaryCustomer._id,
        type: 'EVENT_UPDATE',
        message: 'Organizer Note: Fast-track entry gates for "NextGen AI Summit" are now open with live badge scanning.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      },
    ];

    await Notification.insertMany(notificationsData);
    console.log(`✅ Seeded ${notificationsData.length} in-app notifications.`);

    console.log('\n=================================================================');
    console.log('🎉 FRESH DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('=================================================================');
    console.log('Available Login Credentials:');
    console.log('  1. Admin:     admin@eventhub.com     / admin123');
    console.log('  2. Organizer: organizer@eventhub.com / organizer123  (Priya Sharma)');
    console.log('  3. Organizer: music.org@eventhub.com / organizer123  (Kabir Mehta)');
    console.log('  4. Customer:  customer@eventhub.com  / customer123   (Krish Patel)');
    console.log('-----------------------------------------------------------------');
    console.log("Ready-to-Scan Gate Test Tickets for Today's AI Summit:");
    console.log(`  • Krish Patel (VIP Pass):       Ticket Ref: #BKG-${bkg1._id.toString().slice(-6).toUpperCase()}`);
    gateTestTickets.forEach((t, idx) => {
      console.log(`  • Attendee ${idx + 1}:                Ticket Ref: ${t.ticketRef}`);
    });
    console.log('=================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedDB();
