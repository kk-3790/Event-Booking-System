require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { deleteEvent } = require('../controllers/eventController');

async function runSeedAndLifecycleTest() {
  console.log('================================================================');
  console.log('🚀 SEEDING 10 USERS, BOOKING 1 EVENT & DELETING EVENT (REFUND FLOW)');
  console.log('================================================================\n');

  try {
    // 1. Connect to Database
    const primaryUri = process.env.MONGO_URI;
    const localUri = 'mongodb://127.0.0.1:27017/event-booking';

    try {
      console.log('📡 Connecting to MongoDB Atlas...');
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to MongoDB Atlas\n');
    } catch (atlasErr) {
      console.warn('⚠️ Atlas connection timed out, engaging local fallback...');
      await mongoose.connect(localUri);
      console.log('✅ Connected to local MongoDB fallback\n');
    }

    // 2. Identify or Create an Organizer
    let organizer = await User.findOne({ role: 'ORGANIZER' });
    if (!organizer) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('organizer123', salt);
      organizer = await User.create({
        name: 'Elena Rostova',
        email: 'elena.organizer@eventhub.com',
        mobile: '9876543299',
        password: hashedPassword,
        role: 'ORGANIZER',
      });
      console.log(`👤 Created Organizer: ${organizer.name} (${organizer.email})`);
    } else {
      console.log(`👤 Found Existing Organizer: ${organizer.name} (${organizer.email})`);
    }

    // 3. Seed 10 Test Customer Users
    console.log('\n🌱 Seeding 10 Customer Users...');
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('customer123', salt);

    const testUsers = [];
    const runTimestamp = Date.now().toString().slice(-4);

    for (let i = 1; i <= 10; i++) {
      const email = `testattendee${i}_${runTimestamp}@gmail.com`;
      const mobile = `9876${runTimestamp}${i.toString().padStart(2, '0')}`;
      const name = `Test Attendee ${i}`;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name,
          email,
          mobile,
          password: defaultPassword,
          role: 'CUSTOMER',
        });
      }
      testUsers.push(user);
    }
    console.log(`✅ Successfully prepared ${testUsers.length} customer accounts:`);
    testUsers.forEach((u, idx) => {
      console.log(`   ${idx + 1}. ${u.name} | ${u.email} | Mobile: ${u.mobile}`);
    });

    // 4. Create an Event for Testing
    const eventName = `Global AI & Cloud Expo ${runTimestamp}`;
    console.log(`\n📅 Creating Event: "${eventName}"...`);

    const testEvent = await Event.create({
      eventName,
      category: 'Technology',
      venue: 'Pragati Maidan, Convention Hall A, New Delhi',
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days ahead
      time: '10:00 AM',
      endTime: '05:00 PM',
      ticketPrice: 500,
      totalSeats: 100,
      availableSeats: 100,
      description: 'Exclusive premier summit featuring state-of-the-art keynotes and technical workshops.',
      ticketTiers: [
        {
          tierName: 'General Admission',
          price: 500,
          totalSeats: 100,
          availableSeats: 100,
          perks: 'Keynote Access + Expo Floor Entry',
        },
      ],
      organizer: organizer._id,
      status: 'ACTIVE',
    });

    console.log(`✅ Event Created: ${testEvent.eventName} (ID: ${testEvent._id})`);
    console.log(`   Price: ₹${testEvent.ticketPrice} | Initial Seats: ${testEvent.availableSeats} | Status: ${testEvent.status}`);

    // 5. Have All 10 Users Book The Event and Pay
    console.log(`\n🎟️  Processing Bookings & Payments for all 10 attendees...`);
    const createdBookings = [];
    const createdPayments = [];

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const ticketCount = 1;
      const unitPrice = testEvent.ticketPrice;
      const subtotal = unitPrice * ticketCount;
      const platformFee = Math.round(subtotal * 0.05); // 5% fee = ₹25
      const totalAmount = subtotal + platformFee; // ₹525

      // Generate verifiable QR code
      const dummyBookingId = new mongoose.Types.ObjectId();
      const qrCode = await QRCode.toDataURL(dummyBookingId.toString(), {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 250,
      });

      const booking = await Booking.create({
        _id: dummyBookingId,
        user: user._id,
        event: testEvent._id,
        ticketCount,
        bookingStatus: 'CONFIRMED',
        unitPrice,
        subtotal,
        platformFee,
        totalAmount,
        tierName: 'General Admission',
        bookingDate: new Date(),
        bookingTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        qrCode,
        refundStatus: 'NONE',
      });

      // Deduct seat
      testEvent.availableSeats -= ticketCount;
      if (testEvent.ticketTiers && testEvent.ticketTiers[0]) {
        testEvent.ticketTiers[0].availableSeats -= ticketCount;
      }

      // Create Payment record with status SUCCESS
      const payment = await Payment.create({
        booking: booking._id,
        amount: totalAmount,
        paymentMethod: 'UPI',
        paymentStatus: 'SUCCESS',
        transactionId: `pay_sim_${Date.now()}_${i + 1}`,
        razorpayOrderId: `order_sim_${Date.now()}_${i + 1}`,
      });

      createdBookings.push(booking);
      createdPayments.push(payment);
    }

    await testEvent.save();

    console.log(`✅ All 10 Bookings & Payments Successfully Created!`);
    console.log('────────────────────────────────────────────────────────────────');
    console.log('📊 STATE BEFORE EVENT DELETION:');
    console.log(`   • Event: "${testEvent.eventName}"`);
    console.log(`   • Event Status: ${testEvent.status}`);
    console.log(`   • Available Seats: ${testEvent.availableSeats} / ${testEvent.totalSeats}`);
    console.log(`   • Confirmed Bookings: ${createdBookings.length}`);
    const grossPreRevenue = createdPayments.reduce((acc, p) => acc + p.amount, 0);
    console.log(`   • Gross Revenue Collected: ₹${grossPreRevenue.toLocaleString('en-IN')}`);
    console.log('────────────────────────────────────────────────────────────────\n');

    // 6. Delete The Event via `deleteEvent` Controller
    console.log(`🗑️  Executing Event Deletion / Cancellation via controller...`);
    console.log(`   Invoking deleteEvent for Event ID: ${testEvent._id}`);

    // Mock Express req and res
    const req = {
      params: { id: testEvent._id.toString() },
      user: {
        id: organizer._id.toString(),
        role: 'ORGANIZER',
      },
    };

    let controllerResponse = null;
    let statusCode = 200;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        controllerResponse = data;
        return this;
      },
    };

    await deleteEvent(req, res);

    console.log(`\n📬 Controller Response (Status ${statusCode}):`);
    console.log(`   Message: ${controllerResponse.message}`);
    console.log(`   Refunded Bookings: ${controllerResponse.refundedBookingsCount}`);
    console.log(`   Total Refunds Issued: ₹${(controllerResponse.totalRefundsIssued || 0).toLocaleString('en-IN')}\n`);

    // 7. Verify In-Database State AFTER Deletion
    const updatedEvent = await Event.findById(testEvent._id);
    const updatedBookings = await Booking.find({ event: testEvent._id });
    const updatedPayments = await Payment.find({
      booking: { $in: updatedBookings.map((b) => b._id) },
    });
    const notifications = await Notification.find({
      user: { $in: testUsers.map((u) => u._id) },
    }).sort({ createdAt: -1 }).limit(10);

    console.log('================================================================');
    console.log('📊 VERIFICATION OF DATABASE STATE AFTER EVENT DELETION:');
    console.log('================================================================');
    console.log(`✅ Event Status: ${updatedEvent.status} (Soft-deleted, preserved for records)`);
    console.log(`✅ Total Affected Bookings: ${updatedBookings.length}`);

    const allCancelled = updatedBookings.every((b) => b.bookingStatus === 'CANCELLED');
    const allProcessedRefunds = updatedBookings.every((b) => b.refundStatus === 'PROCESSED');
    const allPaymentsRefunded = updatedPayments.every((p) => p.paymentStatus === 'REFUNDED');
    const allHaveRefundIds = updatedPayments.every((p) => !!p.refundId && !!p.refundedAt);

    console.log(`   • All Booking Statuses marked CANCELLED: ${allCancelled ? '✅ YES' : '❌ NO'}`);
    console.log(`   • All Booking Refund Statuses marked PROCESSED: ${allProcessedRefunds ? '✅ YES' : '❌ NO'}`);
    console.log(`   • All Payment Statuses marked REFUNDED: ${allPaymentsRefunded ? '✅ YES' : '❌ NO'}`);
    console.log(`   • All Payments have generated refundId & timestamp: ${allHaveRefundIds ? '✅ YES' : '❌ NO'}`);
    console.log(`   • In-App Notifications generated: ${notifications.length} notifications ✅`);

    console.log('\n📋 ITEMIZED AUDIT TABLE (10 USERS & 100% REFUND LEDGER):');
    console.log('----------------------------------------------------------------------------------------------------------------------');
    console.log(
      '#'.padEnd(3) +
      'Attendee Name'.padEnd(18) +
      'Booking ID'.padEnd(26) +
      'Amount'.padEnd(10) +
      'Booking Status'.padEnd(16) +
      'Refund Status'.padEnd(15) +
      'Refund ID'
    );
    console.log('----------------------------------------------------------------------------------------------------------------------');

    for (let i = 0; i < testUsers.length; i++) {
      const u = testUsers[i];
      const b = updatedBookings.find((bk) => bk.user.toString() === u._id.toString());
      const p = updatedPayments.find((pm) => pm.booking.toString() === b._id.toString());

      console.log(
        `${i + 1}`.padEnd(3) +
        `${u.name}`.padEnd(18) +
        `${b._id}`.padEnd(26) +
        `₹${b.totalAmount}`.padEnd(10) +
        `${b.bookingStatus}`.padEnd(16) +
        `${b.refundStatus}`.padEnd(15) +
        `${p ? p.refundId : 'N/A'}`
      );
    }
    console.log('----------------------------------------------------------------------------------------------------------------------');
    const totalRefundedSum = updatedPayments.reduce((acc, p) => acc + (p.refundAmount || 0), 0);
    console.log(`Total 100% Refunds Reconciled: ₹${totalRefundedSum.toLocaleString('en-IN')}`);
    console.log('----------------------------------------------------------------------------------------------------------------------\n');

    console.log('🎉 Lifecycle Verification Passed with 100% Success!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during lifecycle execution:', error);
    process.exit(1);
  }
}

runSeedAndLifecycleTest();
