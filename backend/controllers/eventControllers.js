const Event = require('../models/Event');

// R.3.1 Add Event
// POST /api/events  (Organizer only)
const createEvent = async (req, res) => {
  try {
    const { eventName, category, venue, date, time, ticketPrice, availableSeats } = req.body;

    if (!eventName || !category || !venue || !date || !time || ticketPrice == null || availableSeats == null) {
      return res.status(400).json({ message: 'All event fields are required' });
    }

    const event = await Event.create({
      eventName,
      category,
      venue,
      date,
      time,
      ticketPrice,
      availableSeats,
      organizer: req.user.id,
    });

    res.status(201).json({ message: 'Event added successfully', event });
  } catch (err) {
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

    const allowedFields = ['eventName', 'category', 'venue', 'date', 'time', 'ticketPrice', 'availableSeats', 'status'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) event[field] = req.body[field];
    });

    await event.save();
    res.status(200).json({ message: 'Event updated successfully', event });
  } catch (err) {
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

    await event.deleteOne();
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete event', error: err.message });
  }
};

// R.3.4 View Events
// GET /api/events  (public)
const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find({ status: 'ACTIVE' }).populate('organizer', 'name email');
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch events', error: err.message });
  }
};

// Get single event by ID
// GET /api/events/:id  (public)
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'name email');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch event', error: err.message });
  }
};

// R.3.5 Search and Filter Events
// GET /api/events/search?query=music&category=Concert&date=2026-08-15&location=Ahmedabad
const searchEvents = async (req, res) => {
  try {
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

    const events = await Event.find(filter).populate('organizer', 'name email');
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
};

module.exports = {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventById,
  searchEvents,
};