require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Event = require('./models/Event');
const Booking = require('./models/Booking');
const Payment = require('./models/Payment');
const Receipt = require('./models/Receipt');
const RewardDraw = require('./models/RewardDraw');
const Notification = require('./models/Notification');

const seedDB = async () => {
  try {
    try {
      console.log('Connecting to MongoDB Atlas for seeding...');
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to MongoDB Atlas successfully');
    } catch (atlasErr) {
      console.warn('⚠️  Could not connect to Atlas (IP 43.249.234.163 not whitelisted on Atlas dashboard).');
      console.log('🔄 Falling back to local MongoDB for seeding...');
      await mongoose.connect('mongodb://127.0.0.1:27017/event-booking');
      console.log('✅ Connected to local MongoDB successfully');
    }

    // Clear existing collections
    await User.deleteMany({});
    await Event.deleteMany({});
    await Booking.deleteMany({});
    await Payment.deleteMany({});
    await Receipt.deleteMany({});
    await RewardDraw.deleteMany({});
    await Notification.deleteMany({});
    console.log('Cleared existing collections.');

    // 1. Hash Passwords
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('admin123', salt);
    const orgPass = await bcrypt.hash('organizer123', salt);
    const custPass = await bcrypt.hash('customer123', salt);

    // 2. Create Users
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

    console.log(`Created 9 users (1 Admin, 2 Organizers, 7 Customers).`);

    // 3. Helper for Future Dates
    const now = new Date();
    const futureDate = (daysAhead) => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysAhead);
      return d;
    };

    // 4. Create Diverse Events
    const eventsData = [
      {
        eventName: 'NextGen AI & Cloud Architecture Summit 2026',
        category: 'Technology',
        venue: 'Grand Tech Pavilion, SG Highway, Ahmedabad',
        date: futureDate(14),
        time: '10:00',
        endTime: '18:00',
        ticketPrice: 1499,
        availableSeats: 160,
        organizer: organizer1._id,
        status: 'ACTIVE',
      },
      {
        eventName: 'Neon Echoes: Live Acoustic Sunset Festival',
        category: 'Concerts',
        venue: 'Riverfront Open Amphitheater, Ahmedabad',
        date: futureDate(21),
        time: '18:30',
        endTime: '22:30',
        ticketPrice: 899,
        availableSeats: 310,
        organizer: organizer2._id,
        status: 'ACTIVE',
      },
      {
        eventName: 'Fullstack React 19 & Tailwind CSS Masterclass',
        category: 'Workshops',
        venue: 'CodeCraft Innovation Hub, Bodakdev, Ahmedabad',
        date: futureDate(7),
        time: '14:00',
        endTime: '18:00',
        ticketPrice: 499,
        availableSeats: 40,
        organizer: organizer1._id,
        status: 'ACTIVE',
      },
      {
        eventName: 'Global Founders & Seed Investors Mixer',
        category: 'Networking',
        venue: 'Skyline Club & Terrace Lounge, Satellite, Ahmedabad',
        date: futureDate(28),
        time: '19:00',
        endTime: '22:00',
        ticketPrice: 1999,
        availableSeats: 70,
        organizer: organizer1._id,
        status: 'ACTIVE',
      },
      {
        eventName: 'Inter-City Badminton League Championship',
        category: 'Sports',
        venue: 'Apex Indoor Sports Complex, Memnagar, Ahmedabad',
        date: futureDate(10),
        time: '09:00',
        endTime: '17:00',
        ticketPrice: 299,
        availableSeats: 105,
        organizer: organizer1._id,
        status: 'ACTIVE',
      },
      {
        eventName: 'CyberSecurity DefCamp & Ethical Hacking Forum',
        category: 'Technology',
        venue: 'Nasscom Startup Arena, Whitefield, Bengaluru',
        date: futureDate(35),
        time: '09:30',
        endTime: '17:30',
        ticketPrice: 1299,
        availableSeats: 120,
        organizer: organizer1._id,
        status: 'ACTIVE',
      },
      {
        eventName: 'Indie Rock Under the Stars',
        category: 'Concerts',
        venue: 'Bandra Seaside Fort, Bandra West, Mumbai',
        date: futureDate(18),
        time: '19:00',
        endTime: '23:00',
        ticketPrice: 799,
        availableSeats: 250,
        organizer: organizer2._id,
        status: 'ACTIVE',
      },
      {
        eventName: 'Design Systems & Micro-Interactions Bootcamp',
        category: 'Workshops',
        venue: 'Viman Nagar Creative Studio, Pune',
        date: futureDate(25),
        time: '11:00',
        endTime: '16:00',
        ticketPrice: 599,
        availableSeats: 50,
        organizer: organizer1._id,
        status: 'ACTIVE',
      },
    ];

    const createdEvents = await Event.insertMany(eventsData);
    console.log(`Created ${createdEvents.length} events across categories and venues.`);

    const aiEvent = createdEvents[0];
    const concertEvent = createdEvents[1];
    const workshopEvent = createdEvents[2];
    const networkingEvent = createdEvents[3];

    // 5. Seed Bookings, Payments, and Receipts
    // Booking 1: Confirmed booking for primaryCustomer on AI Summit
    const bkg1 = await Booking.create({
      user: primaryCustomer._id,
      event: aiEvent._id,
      ticketCount: 2,
      bookingStatus: 'CONFIRMED',
      bookingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      isPromotional: true,
    });

    const pay1 = await Payment.create({
      booking: bkg1._id,
      amount: aiEvent.ticketPrice * 2,
      razorpayOrderId: 'order_seed_984210',
      transactionId: 'pay_upi_tr762810',
      paymentMethod: 'UPI',
      paymentStatus: 'SUCCESS',
    });

    await Receipt.create({
      payment: pay1._id,
      amount: pay1.amount,
      generatedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    // Booking 2: PENDING booking for primaryCustomer (with live 10-minute hold!)
    const bkg2 = await Booking.create({
      user: primaryCustomer._id,
      event: concertEvent._id,
      ticketCount: 1,
      bookingStatus: 'PENDING',
      expiresAt: new Date(Date.now() + 9 * 60 * 1000 + 45 * 1000), // ~9m 45s left
      bookingDate: new Date(),
      isPromotional: false,
    });

    // Booking 3: Cancelled booking for primaryCustomer
    await Booking.create({
      user: primaryCustomer._id,
      event: workshopEvent._id,
      ticketCount: 1,
      bookingStatus: 'CANCELLED',
      bookingDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    // Bookings 4+: Seed Attendee Bookings for Organizer's Attendee List testing
    const attendeeBookings = [
      { user: attendeeUsers[0]._id, event: aiEvent._id, ticketCount: 1, status: 'CONFIRMED', method: 'Card' },
      { user: attendeeUsers[1]._id, event: aiEvent._id, ticketCount: 3, status: 'CONFIRMED', method: 'UPI' },
      { user: attendeeUsers[2]._id, event: aiEvent._id, ticketCount: 2, status: 'CONFIRMED', method: 'Netbanking' },
      { user: attendeeUsers[3]._id, event: aiEvent._id, ticketCount: 1, status: 'PENDING', method: 'UPI' },
      { user: attendeeUsers[4]._id, event: concertEvent._id, ticketCount: 2, status: 'CONFIRMED', method: 'UPI' },
      { user: attendeeUsers[5]._id, event: concertEvent._id, ticketCount: 4, status: 'CONFIRMED', method: 'Card' },
      { user: attendeeUsers[0]._id, event: networkingEvent._id, ticketCount: 1, status: 'CONFIRMED', method: 'UPI' },
    ];

    for (let i = 0; i < attendeeBookings.length; i++) {
      const item = attendeeBookings[i];
      const ev = createdEvents.find((e) => e._id.toString() === item.event.toString());
      const bkg = await Booking.create({
        user: item.user,
        event: item.event,
        ticketCount: item.ticketCount,
        bookingStatus: item.status,
        expiresAt: item.status === 'PENDING' ? new Date(Date.now() + 8 * 60 * 1000) : undefined,
        bookingDate: new Date(Date.now() - (i + 1) * 12 * 60 * 60 * 1000),
      });

      if (item.status === 'CONFIRMED') {
        const p = await Payment.create({
          booking: bkg._id,
          amount: (ev.ticketPrice || 500) * item.ticketCount,
          razorpayOrderId: `order_seed_att_${i + 1}`,
          transactionId: `pay_seed_txn_${i + 1}_${Date.now()}`,
          paymentMethod: item.method,
          paymentStatus: 'SUCCESS',
        });
        await Receipt.create({
          payment: p._id,
          amount: p.amount,
          generatedDate: new Date(Date.now() - (i + 1) * 12 * 60 * 60 * 1000),
        });
      }
    }

    console.log('Seeded multiple customer and attendee bookings with payments & receipts.');

    // 6. Seed Reward Draws / Lucky Draw Campaigns
    // Active Lucky Draw for AI Summit
    await RewardDraw.create({
      event: aiEvent._id,
      promoTicketPrice: 1124,
      discountPercentage: 25,
      numberOfWinners: 2,
      participants: [primaryCustomer._id, attendeeUsers[0]._id, attendeeUsers[1]._id],
      drawStatus: 'OPEN',
      drawDate: futureDate(7),
    });

    // Completed Lucky Draw for Workshop Event
    await RewardDraw.create({
      event: workshopEvent._id,
      promoTicketPrice: 399,
      discountPercentage: 20,
      numberOfWinners: 1,
      participants: [primaryCustomer._id, attendeeUsers[2]._id, attendeeUsers[3]._id],
      winners: [primaryCustomer._id],
      drawStatus: 'COMPLETED',
      drawDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    console.log('Seeded active and completed RewardDraw campaigns.');

    // 7. Seed In-App Notifications for Krish Patel
    const notificationsData = [
      {
        user: primaryCustomer._id,
        booking: bkg1._id,
        type: 'BOOKING_CONFIRMATION',
        message: 'Your passes for "NextGen AI & Cloud Architecture Summit 2026" have been confirmed! QR gate code unlocked.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        user: primaryCustomer._id,
        booking: bkg2._id,
        type: 'EVENT_REMINDER',
        message: 'Seats held! Complete your payment for "Neon Echoes: Live Acoustic Sunset Festival" before the hold expires.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        user: primaryCustomer._id,
        type: 'DRAW_RESULT',
        message: '🎉 Congratulations! You have won the Lucky Draw for "Fullstack React 19 & Tailwind CSS Masterclass"! Your VIP perk is active.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        user: primaryCustomer._id,
        type: 'EVENT_UPDATE',
        message: 'Organizer Note: Entry gates for "NextGen AI Summit" will open at 09:15 AM sharp with badge pick-up available.',
        channel: 'EMAIL',
        status: 'SENT',
        timestamp: new Date(Date.now() - 36 * 60 * 1000),
      },
    ];

    await Notification.insertMany(notificationsData);
    console.log(`Seeded ${notificationsData.length} in-app notifications.`);

    console.log('\n======================================================');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('Available Accounts:');
    console.log('1. Admin:     admin@eventhub.com     / admin123');
    console.log('2. Organizer: organizer@eventhub.com / organizer123');
    console.log('3. Organizer: music.org@eventhub.com / organizer123');
    console.log('4. Customer:  customer@eventhub.com  / customer123');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedDB();
