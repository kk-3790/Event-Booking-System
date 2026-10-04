const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { computeLiveStatus, getEventStart } = require('../utils/eventTiming');

// Generates a high-contrast scannable QR Code Data URL for instant gate admission
const generateBookingQrCode = async (bookingId) => {
  try {
    return await QRCode.toDataURL(bookingId.toString(), {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('QR code generation failed:', err.message);
    return null;
  }
};

const { expireIfNeeded, BOOKING_HOLD_MINUTES } = require('../utils/bookingExpiry');


// R.4.1 Book Ticket
// POST /api/bookings  (Customer only)
const bookTicket = async (req, res) => {
  try {
    const { eventId, ticketCount, isPromotional, promoCode, tierName } = req.body;

    if (!eventId || !ticketCount || ticketCount < 1) {
      return res.status(400).json({ message: 'eventId and a valid ticketCount are required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (event.status === 'CANCELLED') {
      return res.status(400).json({ message: 'This event has been cancelled' });
    }

    const liveStatus = computeLiveStatus(event);
    if (liveStatus !== 'ACTIVE') {
      if (event.status !== liveStatus) {
        event.status = liveStatus;
        await event.save();
      }
      const message =
        liveStatus === 'ONGOING'
          ? 'This event has already started and is no longer accepting bookings'
          : 'This event has already ended and is no longer accepting bookings';
      return res.status(400).json({ message });
    }

    let selectedTier = null;
    let baseTicketPrice = event.ticketPrice;

    if (event.ticketTiers && event.ticketTiers.length > 0) {
      if (tierName) {
        selectedTier = event.ticketTiers.find(
          (t) => t.tierName.toLowerCase() === tierName.trim().toLowerCase()
        );
      }
      if (!selectedTier) {
        selectedTier = event.ticketTiers[0];
      }

      if (selectedTier.availableSeats < ticketCount) {
        return res.status(409).json({
          message: `Not enough seats in tier "${selectedTier.tierName}". Available: ${selectedTier.availableSeats}`,
        });
      }

      selectedTier.availableSeats -= ticketCount;
      event.availableSeats -= ticketCount;
      await event.save();
      baseTicketPrice = selectedTier.price;
    } else {
      const updatedEvent = await Event.findOneAndUpdate(
        { _id: eventId, availableSeats: { $gte: ticketCount } },
        { $inc: { availableSeats: -ticketCount } },
        { new: true }
      );

      if (!updatedEvent) {
        return res.status(409).json({ message: 'Not enough seats available for this booking' });
      }
    }

    const expiresAt = new Date(Date.now() + BOOKING_HOLD_MINUTES * 60 * 1000);

    const STATIC_PROMOS = {
      'LUCKY20': 20,
      'EARLYBIRD': 15,
      'VIP50': 50,
      'EVENTHUB10': 10,
    };

    let unitPrice = baseTicketPrice;
    const cleanPromo = (promoCode || '').trim().toUpperCase();
    let appliedVoucher = null;

    if (cleanPromo) {
      const Voucher = require('../models/Voucher');
      const voucher = await Voucher.findOne({
        code: cleanPromo,
        user: req.user.id,
        isRedeemed: false,
      });

      if (voucher) {
        const eventDoc = await Event.findById(eventId);
        if (eventDoc && eventDoc.organizer.toString() === voucher.organizer.toString()) {
          unitPrice = Math.round(baseTicketPrice * (1 - voucher.discountPercentage / 100));
          appliedVoucher = voucher;
        }
      }
    }

    if (!appliedVoucher) {
      if (cleanPromo && STATIC_PROMOS[cleanPromo]) {
        const discount = STATIC_PROMOS[cleanPromo];
        unitPrice = Math.round(baseTicketPrice * (1 - discount / 100));
      }
    }

    const isEnrolledInDraw = Boolean(
      isPromotional ||
      cleanPromo === 'LUCKYDRAW' ||
      cleanPromo === 'LUCKY' ||
      cleanPromo === 'DRAW'
    );

    const subtotal = ticketCount * unitPrice;
    const platformFee = Math.round(subtotal * 0.05);
    const totalAmount = subtotal + platformFee;

    const now = new Date();
    const bookingTime = now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const bookingId = new mongoose.Types.ObjectId();
    const qrCode = await generateBookingQrCode(bookingId);

    const booking = await Booking.create({
      _id: bookingId,
      user: req.user.id,
      event: eventId,
      tierName: selectedTier ? selectedTier.tierName : (tierName || 'General Admission'),
      bookingDate: now,
      bookingTime,
      ticketCount,
      promoCode: cleanPromo || undefined,
      unitPrice,
      subtotal,
      platformFee,
      totalAmount,
      bookingStatus: 'PENDING', // becomes CONFIRMED once payment succeeds
      expiresAt,
      isPromotional: isEnrolledInDraw,
      qrCode,
    });

    if (appliedVoucher) {
      appliedVoucher.isRedeemed = true;
      appliedVoucher.redeemedAt = new Date();
      appliedVoucher.redeemedBooking = booking._id;
      await appliedVoucher.save();
    }

    if (isEnrolledInDraw) {
      const RewardDraw = require('../models/RewardDraw');
      await RewardDraw.findOneAndUpdate(
        { event: eventId, drawStatus: 'OPEN' },
        { $addToSet: { participants: req.user.id } }
      );
    }

    res.status(201).json({
      message: `Booking created successfully. Complete payment within ${BOOKING_HOLD_MINUTES} minutes or seats will be released.`,
      booking,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create booking', error: err.message });
  }
};

// R.4.2 Cancel Booking
// DELETE /api/bookings/:id  (owner of the booking, or Admin)
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'Customer self-cancellation is disabled. Ticket cancellations and refunds are managed exclusively by event hosts and administrators.',
      });
    }

    await expireIfNeeded(booking);

    if (booking.bookingStatus === 'EXPIRED') {
      return res.status(400).json({ message: 'This booking already expired and its seats were released' });
    }
    if (booking.bookingStatus === 'CANCELLED') {
      return res.status(400).json({ message: 'This booking is already cancelled' });
    }

    booking.bookingStatus = 'CANCELLED';
    booking.cancellationReason = req.body?.reason || 'Cancelled by attendee';

    // Query successful payment and process refund
    const Payment = require('../models/Payment');
    const payment = await Payment.findOne({ booking: booking._id, paymentStatus: 'SUCCESS' });
    let refundedAmount = 0;

    if (payment) {
      refundedAmount = payment.amount;
      let gatewayRefundId = null;

      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && payment.transactionId) {
        try {
          const Razorpay = require('razorpay');
          const rzp = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          const rzpRefund = await rzp.payments.refund(payment.transactionId, {
            amount: Math.round(payment.amount * 100),
            notes: {
              reason: `Customer self-cancellation: ${booking._id}`,
              bookingId: booking._id.toString(),
            },
          });
          if (rzpRefund && rzpRefund.id) {
            gatewayRefundId = rzpRefund.id;
            console.log(`[Razorpay Refund Succeeded]: Gateway ID ${rzpRefund.id} for booking ${booking._id}`);
          }
        } catch (rzpErr) {
          const description = rzpErr?.error?.description || rzpErr?.message || 'Gateway simulated / non-live ID';
          console.warn(`[Razorpay Refund Notice]:`, description);
        }
      }

      payment.paymentStatus = 'REFUNDED';
      payment.refundId = gatewayRefundId || `rfnd_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      payment.refundAmount = refundedAmount;
      payment.refundedAt = new Date();
      await payment.save();

      booking.refundStatus = 'PROCESSED';
    } else {
      booking.refundStatus = 'NONE';
    }

    await booking.save();

    // Release the seats back to the event
    const event = await Event.findById(booking.event);
    if (event) {
      event.availableSeats += booking.ticketCount;
      if (booking.tierName && event.ticketTiers && event.ticketTiers.length > 0) {
        const tier = event.ticketTiers.find((t) => t.tierName === booking.tierName);
        if (tier) tier.availableSeats += booking.ticketCount;
      }
      await event.save();
    }

    res.status(200).json({
      message: 'Booking cancelled successfully' + (refundedAmount > 0 ? ` and 100% refund of ₹${refundedAmount} initiated.` : '.'),
      booking,
      refundedAmount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking', error: err.message });
  }
};

// R.4.3 View Booking History
// GET /api/bookings/my  (logged-in user's own bookings)
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate({
        path: 'event',
        select: 'eventName date time venue ticketPrice organizer category bannerImage ticketTiers',
        populate: {
          path: 'organizer',
          select: 'name email mobile role'
        }
      })
      .sort({ createdAt: -1 });

    await Promise.all(
      bookings.map(async (booking) => {
        if (booking.bookingStatus === 'CONFIRMED') {
          if (booking.cancellationReason) {
            booking.cancellationReason = undefined;
            await booking.save();
          }
        } else {
          await expireIfNeeded(booking);
        }
        if (!booking.qrCode) {
          booking.qrCode = await generateBookingQrCode(booking._id);
          await booking.save();
        }
      })
    );

    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking history', error: err.message });
  }
};

// Get single booking by ID (owner or Admin)
// GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'event',
        populate: {
          path: 'organizer',
          select: 'name email mobile role'
        }
      })
      .populate('user', 'name email mobile');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (req.user.role !== 'ADMIN' && booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to view this booking' });
    }
    await expireIfNeeded(booking);
    if (!booking.qrCode) {
      booking.qrCode = await generateBookingQrCode(booking._id);
      await booking.save();
    }
    res.status(200).json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking', error: err.message });
  }
};

// Get all attendees / bookings for an event (Organizer owner or Admin)
// GET /api/bookings/event/:eventId
const getEventAttendees = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (req.user.role !== 'ADMIN' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to view attendees for this event' });
    }

    const bookings = await Booking.find({ event: req.params.eventId })
      .populate('user', 'name email mobile')
      .sort({ createdAt: -1 });

    const confirmedBookings = bookings.filter((b) => b.bookingStatus === 'CONFIRMED');
    const totalConfirmedSeats = confirmedBookings.reduce((sum, b) => sum + (b.ticketCount || 0), 0);
    const totalRevenue = totalConfirmedSeats * (event.ticketPrice || 0);
    const checkedInBookings = confirmedBookings.filter((b) => b.checkedIn);
    const totalCheckedInSeats = checkedInBookings.reduce((sum, b) => sum + (b.ticketCount || 0), 0);

    res.status(200).json({
      event: {
        _id: event._id,
        eventName: event.eventName,
        date: event.date,
        time: event.time,
        venue: event.venue,
        totalSeats: event.totalSeats,
        availableSeats: event.availableSeats,
        ticketPrice: event.ticketPrice,
        ticketTiers: event.ticketTiers || [],
      },
      stats: {
        totalBookings: bookings.length,
        confirmedBookings: confirmedBookings.length,
        totalConfirmedSeats,
        totalRevenue,
        checkedInBookings: checkedInBookings.length,
        totalCheckedInSeats,
      },
      attendees: bookings,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch event attendees', error: err.message });
  }
};

// POST /api/bookings/check-in  (Organizer of event or Admin)
const checkInAttendee = async (req, res) => {
  try {
    const { ticketRef, bookingId, eventId, qrData } = req.body;
    let searchRef = ticketRef || qrData;
    if (searchRef && typeof searchRef === 'string') {
      try {
        const trimmed = searchRef.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const parsed = JSON.parse(trimmed);
          searchRef = parsed.bookingId || searchRef;
        }
      } catch {}
    }
    const searchBookingId = bookingId || (mongoose.isValidObjectId(searchRef) ? searchRef : null);

    if (!searchRef && !searchBookingId) {
      return res.status(400).json({ message: 'Ticket reference code or bookingId is required' });
    }

    let booking = null;

    if (searchBookingId && mongoose.isValidObjectId(searchBookingId)) {
      booking = await Booking.findById(searchBookingId).populate('user', 'name email mobile').populate('event');
    }

    if (!booking && searchRef) {
      const cleanRef = searchRef.trim().toUpperCase().replace('#BKG-', '').replace('BKG-', '');
      if (mongoose.isValidObjectId(cleanRef)) {
        booking = await Booking.findById(cleanRef).populate('user', 'name email mobile').populate('event');
      } else {
        const query = eventId ? { event: eventId } : {};
        const candidates = await Booking.find(query).populate('user', 'name email mobile').populate('event');
        booking = candidates.find((b) => {
          const id = b._id.toString().toUpperCase();
          return id.slice(-6) === cleanRef || id.endsWith(cleanRef);
        });
      }
    }

    if (!booking) {
      return res.status(404).json({ message: 'Ticket pass not found. Please verify the ticket reference number.' });
    }

    const event = booking.event;
    if (!event) {
      return res.status(404).json({ message: 'Event associated with this ticket was not found' });
    }

    if (req.user.role !== 'ADMIN' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: You are not the organizer for this event' });
    }

    if (event.status === 'CANCELLED' || event.status === 'DELETED') {
      return res.status(400).json({
        message: 'Admission Denied: This event has been cancelled by the host.',
        bookingStatus: 'CANCELLED',
      });
    }

    if (event.status === 'COMPLETED' || computeLiveStatus(event) === 'COMPLETED') {
      return res.status(400).json({
        message: 'Admission Closed: This event has already concluded.',
        bookingStatus: 'COMPLETED',
      });
    }

    if (booking.bookingStatus !== 'CONFIRMED') {
      return res.status(400).json({
        message: `Admission Denied: Ticket is ${booking.bookingStatus}. Only CONFIRMED tickets can enter.`,
        bookingStatus: booking.bookingStatus,
        attendee: booking.user,
      });
    }

    if (booking.checkedIn) {
      const formattedTime = booking.checkedInAt
        ? new Date(booking.checkedInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : 'Earlier';
      return res.status(409).json({
        message: `⚠️ Already Checked In: This ticket was verified at ${formattedTime}.`,
        alreadyCheckedIn: true,
        checkedInAt: booking.checkedInAt,
        attendee: booking.user,
        booking,
      });
    }

    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    booking.checkedInBy = req.user.id;
    await booking.save();

    res.status(200).json({
      message: `🎉 Admission Approved! Welcome, ${booking.user?.name || 'Attendee'}.`,
      success: true,
      booking,
      attendee: booking.user,
      event: {
        _id: event._id,
        eventName: event.eventName,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Gate check-in failed', error: err.message });
  }
};

module.exports = {
  bookTicket,
  cancelBooking,
  getMyBookings,
  getBookingById,
  getEventAttendees,
  checkInAttendee,
};