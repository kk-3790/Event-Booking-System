const Event = require('../models/Event');
const { computeLiveStatus } = require('../utils/eventTiming');

// Syncs any event whose live status (based on actual start/end time) no
// longer matches its stored status. Called before returning event listings
// so customers see accurate ACTIVE/ONGOING/COMPLETED state, while keeping
// the event record intact for booking history and admin reports.
const syncEventStatuses = async () => {
  const now = new Date();

  // Only ACTIVE or ONGOING events can possibly need updating — CANCELLED and
  // already-COMPLETED events never change on their own.
  const candidates = await Event.find({ status: { $in: ['ACTIVE', 'ONGOING'] } });

  const updates = candidates
    .map((event) => ({ event, liveStatus: computeLiveStatus(event, now) }))
    .filter(({ event, liveStatus }) => event.status !== liveStatus);

  if (updates.length === 0) return;

  await Promise.all(
    updates.map(({ event, liveStatus }) =>
      Event.updateOne({ _id: event._id }, { $set: { status: liveStatus } })
    )
  );
};

// R.3.1 Add Event
// POST /api/events  (Organizer only)
const createEvent = async (req, res) => {
  try {
    const {
      eventName,
      category,
      venue,
      date,
      time,
      endTime,
      ticketPrice,
      availableSeats,
      totalSeats,
      bannerImage,
      description,
      ticketTiers,
    } = req.body;

    const hasTiers = Array.isArray(ticketTiers) && ticketTiers.length > 0;
    if (!eventName || !category || !venue || !date || !time || !endTime || (!hasTiers && (ticketPrice == null || availableSeats == null))) {
      return res.status(400).json({ message: 'All event fields are required, including endTime' });
    }

    const { combineDateAndTime } = require('../utils/eventTiming');
    const startDateTime = combineDateAndTime(date, time);
    const endDateTime = combineDateAndTime(date, endTime);

    if (endDateTime <= startDateTime) {
      return res.status(400).json({ message: 'endTime must be after time (start time)' });
    }

    const now = new Date();
    if (startDateTime <= now) {
      return res.status(400).json({ message: 'Event date and start time cannot be in the past. Please choose a future date and time.' });
    }

    // Event names must be unique across the entire platform, regardless of organizer
    const duplicateEvent = await Event.findOne({ eventName: eventName.trim() });
    if (duplicateEvent) {
      return res.status(409).json({ message: 'An event with this name already exists. Please choose a different name.' });
    }

    let formattedTiers = [];
    let finalAvailableSeats = Number(availableSeats) || 0;
    let finalTotalSeats = Number(totalSeats) || finalAvailableSeats;
    let finalPrice = Number(ticketPrice) || 0;

    if (hasTiers) {
      formattedTiers = ticketTiers.map((t) => ({
        tierName: t.tierName || 'Tier Pass',
        price: Number(t.price) || 0,
        totalSeats: Number(t.totalSeats) || 1,
        availableSeats: Number(t.availableSeats !== undefined ? t.availableSeats : t.totalSeats) || 1,
        perks: t.perks || '',
      }));
      finalTotalSeats = formattedTiers.reduce((sum, t) => sum + t.totalSeats, 0);
      finalAvailableSeats = formattedTiers.reduce((sum, t) => sum + t.availableSeats, 0);
      finalPrice = Math.min(...formattedTiers.map((t) => t.price));
    }

    const event = await Event.create({
      eventName,
      category,
      venue,
      date,
      time,
      endTime,
      ticketPrice: finalPrice,
      totalSeats: finalTotalSeats,
      availableSeats: finalAvailableSeats,
      bannerImage: bannerImage || '',
      description: description || '',
      ticketTiers: formattedTiers,
      organizer: req.user.id,
    });

    res.status(201).json({ message: 'Event added successfully', event });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An event with this name already exists. Please choose a different name.' });
    }
    res.status(500).json({ message: 'Failed to create event', error: err.message });
  }
};

// R.3.2 Update Event
// PUT /api/events/:id  (Organizer who owns the event, or Admin)
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Only the organizer who created it (or an admin) can update it
    if (req.user.role !== 'ADMIN' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to update this event' });
    }

    // Cancelled or deleted events cannot be modified
    if (event.status === 'CANCELLED' || event.status === 'DELETED') {
      return res.status(400).json({ message: 'This event has been cancelled and cannot be edited.' });
    }

    // If eventName is being changed, make sure it's not already taken by another event
    if (req.body.eventName && req.body.eventName.trim() !== event.eventName) {
      const duplicateEvent = await Event.findOne({
        eventName: req.body.eventName.trim(),
        _id: { $ne: event._id },
      });
      if (duplicateEvent) {
        return res.status(409).json({ message: 'An event with this name already exists. Please choose a different name.' });
      }
    }

    if (req.body.date || req.body.time || req.body.endTime) {
      const { combineDateAndTime } = require('../utils/eventTiming');
      const updatedDate = req.body.date || event.date;
      const updatedTime = req.body.time || event.time;
      const updatedEndTime = req.body.endTime || event.endTime;
      const startDateTime = combineDateAndTime(updatedDate, updatedTime);
      const endDateTime = combineDateAndTime(updatedDate, updatedEndTime);

      if (endDateTime <= startDateTime) {
        return res.status(400).json({ message: 'endTime must be after time (start time)' });
      }

      if (event.status === 'ACTIVE' && startDateTime <= new Date()) {
        return res.status(400).json({ message: 'Event date and start time cannot be in the past for an active event.' });
      }
    }

    const allowedFields = [
      'eventName',
      'category',
      'venue',
      'date',
      'time',
      'endTime',
      'ticketPrice',
      'availableSeats',
      'totalSeats',
      'status',
      'bannerImage',
      'description',
      'ticketTiers',
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) event[field] = req.body[field];
    });

    if (req.body.ticketTiers && Array.isArray(req.body.ticketTiers) && req.body.ticketTiers.length > 0) {
      event.ticketTiers = req.body.ticketTiers.map((t) => ({
        tierName: t.tierName || 'Tier Pass',
        price: Number(t.price) || 0,
        totalSeats: Number(t.totalSeats) || 1,
        availableSeats: Number(t.availableSeats !== undefined ? t.availableSeats : t.totalSeats) || 1,
        perks: t.perks || '',
      }));
      event.totalSeats = event.ticketTiers.reduce((sum, t) => sum + t.totalSeats, 0);
      event.availableSeats = event.ticketTiers.reduce((sum, t) => sum + t.availableSeats, 0);
    }

    await event.save();
    res.status(200).json({ message: 'Event updated successfully', event });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An event with this name already exists. Please choose a different name.' });
    }
    res.status(500).json({ message: 'Failed to update event', error: err.message });
  }
};

// R.3.3 Delete Event
// DELETE /api/events/:id  (Organizer who owns the event, or Admin)
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (req.user.role !== 'ADMIN' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to delete this event' });
    }

    // Soft delete: Mark event as CANCELLED so it remains visible for Admin oversight and historical audit ledgers
    event.status = 'CANCELLED';
    await event.save();

    // Query all active/confirmed bookings associated with this cancelled event
    const Booking = require('../models/Booking');
    const Payment = require('../models/Payment');
    const { sendEmailNotification } = require('../services/notificationService');

    const affectedBookings = await Booking.find({
      event: event._id,
      bookingStatus: { $in: ['CONFIRMED', 'PENDING'] },
    }).populate('user', 'name email mobile');

    let totalRefundsIssued = 0;

    for (const booking of affectedBookings) {
      const payment = await Payment.findOne({ booking: booking._id, paymentStatus: 'SUCCESS' });
      let refundedAmount = 0;

      if (payment) {
        refundedAmount = payment.amount;
        totalRefundsIssued += refundedAmount;

        // In production/sandbox, trigger Razorpay refund API if configured
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
                reason: `Full refund for cancelled event: ${event.eventName}`,
                bookingId: booking._id.toString(),
              },
            });
            if (rzpRefund && rzpRefund.id) {
              gatewayRefundId = rzpRefund.id;
              console.log(`[Razorpay Refund Succeeded]: Gateway ID ${rzpRefund.id} for payment ${payment.transactionId}`);
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
      }

      booking.bookingStatus = 'CANCELLED';
      booking.cancellationReason = 'Event cancelled by host / organizer';
      booking.refundStatus = payment ? 'PROCESSED' : 'NONE';
      await booking.save();

      // Dispatch real email via Gmail SMTP / notification service and log in-app alert
      if (booking.user) {
        const refundNotice = refundedAmount > 0
          ? `A 100% full refund of ₹${refundedAmount.toLocaleString('en-IN')} has been initiated to your original payment method.`
          : 'Your reservation hold has been released with zero charges.';

        try {
          await sendEmailNotification({
            user: booking.user,
            booking: { ...booking.toObject(), event },
            type: 'EVENT_UPDATE',
            message: `⚠️ Host Cancellation Notice: The event "${event.eventName}" has been cancelled by the host. ${refundNotice} Your digital ticket pass has been marked VOID. We sincerely apologize for any inconvenience.`,
          });
        } catch (notifErr) {
          console.warn('[Notification dispatch failed]:', notifErr.message);
        }
      }
    }

    res.status(200).json({
      message: `Event cancelled successfully. ${affectedBookings.length} attendee reservation(s) cancelled and refunded.`,
      event,
      refundedBookingsCount: affectedBookings.length,
      totalRefundsIssued,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete event', error: err.message });
  }
};

// R.3.4 View Events
// GET /api/events  (public)
const getAllEvents = async (req, res) => {
  try {
    await syncEventStatuses();
    const events = await Event.find({ status: 'ACTIVE' }).populate('organizer', 'name email mobile role').lean();
    const RewardDraw = require('../models/RewardDraw');
    const openDraws = await RewardDraw.find({ drawStatus: 'OPEN' }).select('event discountPercentage numberOfWinners').lean();
    const drawMap = new Map();
    openDraws.forEach((d) => drawMap.set(d.event.toString(), d));
    const eventsWithDraw = events.map((e) => ({
      ...e,
      activeDraw: drawMap.get(e._id.toString()) || null,
    }));
    res.status(200).json(eventsWithDraw);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch events', error: err.message });
  }
};

// GET /api/events/organizer/my-events  (Organizer or Admin only)
// Fetches ALL events (ACTIVE, ONGOING, COMPLETED, CANCELLED) belonging to the organizer
const getOrganizerEvents = async (req, res) => {
  try {
    await syncEventStatuses();
    const query = req.user.role === 'ADMIN' ? {} : { organizer: req.user.id };
    const events = await Event.find(query)
      .populate('organizer', 'name email mobile role')
      .sort({ createdAt: -1 });
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch organizer events', error: err.message });
  }
};

// Get single event by ID
// GET /api/events/:id  (public)
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'name email mobile role');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch event', error: err.message });
  }
};

// Get events currently happening right now (between start and end time)
// GET /api/events/ongoing  (public)
const getOngoingEvents = async (req, res) => {
  try {
    await syncEventStatuses();
    const events = await Event.find({ status: 'ONGOING' }).populate('organizer', 'name email');
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch ongoing events', error: err.message });
  }
};

// R.3.5 Search and Filter Events
// GET /api/events/search?query=music&category=Concert&date=2026-08-15&location=Ahmedabad
const searchEvents = async (req, res) => {
  try {
    await syncEventStatuses();
    const { query, category, date, location } = req.query;
    const filter = { status: 'ACTIVE' };

    if (query) {
      filter.$text = { $search: query };
    }
    if (category) {
      filter.category = category;
    }
    if (location) {
      filter.venue = { $regex: location, $options: 'i' };
    }
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    }

    const events = await Event.find(filter).populate('organizer', 'name email mobile role').lean();
    const RewardDraw = require('../models/RewardDraw');
    const openDraws = await RewardDraw.find({ drawStatus: 'OPEN' }).select('event discountPercentage numberOfWinners').lean();
    const drawMap = new Map();
    openDraws.forEach((d) => drawMap.set(d.event.toString(), d));
    const eventsWithDraw = events.map((e) => ({
      ...e,
      activeDraw: drawMap.get(e._id.toString()) || null,
    }));
    res.status(200).json(eventsWithDraw);
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
};

module.exports = {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getOrganizerEvents,
  getEventById,
  getOngoingEvents,
  searchEvents,
};