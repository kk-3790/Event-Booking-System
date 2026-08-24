const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { computeLiveStatus, getEventStart } = require('../utils/eventTiming');

// How long a PENDING booking holds its seats before it auto-expires and
// releases them back to the event. 10 minutes matches common industry
// practice for ticketing platforms (e.g. BookMyShow-style checkout holds) —
// long enough to complete payment, short enough that seats don't stay
// locked by abandoned bookings.
const BOOKING_HOLD_MINUTES = 10;

// If a booking is PENDING and past its expiresAt, marks it EXPIRED and
// releases its seats back to the event. Called live wherever a booking is
// read/acted on, so expiry is caught immediately rather than only waiting
// for the periodic cleanup job. Returns the (possibly updated) booking.
const expireIfNeeded = async (booking) => {
  if (booking.bookingStatus === 'PENDING' && booking.expiresAt && booking.expiresAt < new Date()) {
    booking.bookingStatus = 'EXPIRED';
    await booking.save();
    await Event.findByIdAndUpdate(booking.event, {
      $inc: { availableSeats: booking.ticketCount },
    });
  }
  return booking;
};


// R.4.1 Book Ticket
// POST /api/bookings  (Customer only)
const bookTicket = async (req, res) => {
  try {
    const { eventId, ticketCount } = req.body;

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

    // Check the event's actual live status right now (based on real
    // start/end time), instead of only trusting the stored `status` field.
    // `status` only flips when someone browses/searches events or the
    // hourly job runs, so it can be stale — without this check, someone
    // could book a ticket for an event that has already started or ended.
    // Bookings are only allowed while the event is still ACTIVE (i.e.
    // before its start time) — once it's ONGOING or COMPLETED, no new
    // tickets can be sold.
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

    // Atomic seat check-and-decrement: only succeeds if availableSeats is
    // still >= ticketCount at the moment of the update. This avoids the
    // classic "read seats, check, then save" race condition where two
    // concurrent requests could both pass the check and oversell the
    // last seat(s). If two requests hit this at once, only one succeeds.
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: eventId, availableSeats: { $gte: ticketCount } },
      { $inc: { availableSeats: -ticketCount } },
      { new: true }
    );

    if (!updatedEvent) {
      return res.status(409).json({ message: 'Not enough seats available for this booking' });
    }

    const expiresAt = new Date(Date.now() + BOOKING_HOLD_MINUTES * 60 * 1000);

    const booking = await Booking.create({
      user: req.user.id,
      event: eventId,
      ticketCount,
      bookingStatus: 'PENDING', // becomes CONFIRMED once payment succeeds
      expiresAt,
    });

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

    if (req.user.role !== 'ADMIN' && booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to cancel this booking' });
    }

    await expireIfNeeded(booking);

    if (booking.bookingStatus === 'EXPIRED') {
      return res.status(400).json({ message: 'This booking already expired and its seats were released' });
    }
    if (booking.bookingStatus === 'CANCELLED') {
      return res.status(400).json({ message: 'This booking is already cancelled' });
    }

    booking.bookingStatus = 'CANCELLED';
    await booking.save();

    // Release the seats back to the event
    await Event.findByIdAndUpdate(booking.event, {
      $inc: { availableSeats: booking.ticketCount },
    });

    res.status(200).json({ message: 'Booking cancelled successfully', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking', error: err.message });
  }
};

// R.4.3 View Booking History
// GET /api/bookings/my  (logged-in user's own bookings)
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('event', 'eventName date time venue ticketPrice')
      .sort({ createdAt: -1 });

    await Promise.all(bookings.map((booking) => expireIfNeeded(booking)));

    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking history', error: err.message });
  }
};

// Get single booking by ID (owner or Admin)
// GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('event').populate('user', 'name email');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (req.user.role !== 'ADMIN' && booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to view this booking' });
    }
    await expireIfNeeded(booking);
    res.status(200).json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking', error: err.message });
  }
};

module.exports = { bookTicket, cancelBooking, getMyBookings, getBookingById };