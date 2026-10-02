const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Report = require('../models/Report');

// R.8.1 Generate Booking Report
// GET /api/reports/bookings?startDate=&endDate=  (Admin only)
const generateBookingReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const filter = {};
    if (startDate || endDate) filter.createdAt = dateFilter;

    // Multi-tenant isolation: If user is an ORGANIZER, restrict to their own events
    if (req.user.role === 'ORGANIZER') {
      const organizerEvents = await Event.find({ organizer: req.user.id }).select('_id');
      const organizerEventIds = organizerEvents.map((e) => e._id);
      filter.event = { $in: organizerEventIds };
    }

    const bookings = await Booking.find(filter)
      .populate('user', 'name email')
      .populate('event', 'eventName date venue ticketPrice');

    const statusCounts = bookings.reduce((acc, b) => {
      acc[b.bookingStatus] = (acc[b.bookingStatus] || 0) + 1;
      return acc;
    }, {});

    const totalTicketsBooked = bookings
      .filter((b) => b.bookingStatus === 'CONFIRMED')
      .reduce((sum, b) => sum + b.ticketCount, 0);

    const bookingIds = bookings.map((b) => b._id);
    const payments = await Payment.find({ booking: { $in: bookingIds }, paymentStatus: 'SUCCESS' });
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    const refundedPayments = await Payment.find({ booking: { $in: bookingIds }, paymentStatus: 'REFUNDED' });
    const totalRefunded = refundedPayments.reduce((sum, p) => sum + (p.refundAmount || p.amount || 0), 0);

    const reportData = {
      dateRange: { startDate: startDate || 'all time', endDate: endDate || 'all time' },
      totalBookings: bookings.length,
      statusBreakdown: statusCounts,
      totalTicketsConfirmed: totalTicketsBooked,
      totalRevenue,
      totalRefunded,
      bookings,
    };

    const report = await Report.create({
      reportType: 'BOOKING',
      generatedBy: req.user.id,
      dateRangeStart: startDate ? new Date(startDate) : undefined,
      dateRangeEnd: endDate ? new Date(endDate) : undefined,
      data: reportData,
    });

    res.status(200).json({ message: 'Booking report generated', reportId: report._id, ...reportData });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate booking report', error: err.message });
  }
};

// R.8.2 Generate Event Report
// GET /api/reports/events?eventId=  OR  ?startDate=&endDate=  (Admin only)
const generateEventReport = async (req, res) => {
  try {
    const { eventId, startDate, endDate } = req.query;

    let events;
    if (eventId) {
      const event = await Event.findById(eventId).populate('organizer', 'name email');
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      if (req.user.role === 'ORGANIZER' && event.organizer?._id?.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied: You do not organize this event' });
      }
      events = [event];
    } else {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      const filter = {};
      if (startDate || endDate) filter.date = dateFilter;
      if (req.user.role === 'ORGANIZER') {
        filter.organizer = req.user.id;
      }

      events = await Event.find(filter).populate('organizer', 'name email');
    }

    const eventSummaries = await Promise.all(
      events.map(async (event) => {
        const bookings = await Booking.find({ event: event._id });
        const confirmedBookings = bookings.filter((b) => b.bookingStatus === 'CONFIRMED');
        const ticketsSold = confirmedBookings.reduce((sum, b) => sum + b.ticketCount, 0);

        const bookingIds = bookings.map((b) => b._id);
        const payments = await Payment.find({ booking: { $in: bookingIds }, paymentStatus: 'SUCCESS' });
        const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

        const refundedPayments = await Payment.find({ booking: { $in: bookingIds }, paymentStatus: 'REFUNDED' });
        const refundedAmount = refundedPayments.reduce((sum, p) => sum + (p.refundAmount || p.amount || 0), 0);

        return {
          eventId: event._id,
          eventName: event.eventName,
          organizer: event.organizer,
          date: event.date,
          venue: event.venue,
          status: event.status,
          totalCapacity: event.availableSeats + ticketsSold,
          seatsRemaining: event.availableSeats,
          ticketsSold,
          totalBookings: bookings.length,
          revenue,
          refundedAmount,
        };
      })
    );

    const reportData = {
      filter: eventId ? { eventId } : { startDate: startDate || 'all time', endDate: endDate || 'all time' },
      totalEvents: eventSummaries.length,
      events: eventSummaries,
    };

    const report = await Report.create({
      reportType: 'EVENT',
      generatedBy: req.user.id,
      dateRangeStart: startDate ? new Date(startDate) : undefined,
      dateRangeEnd: endDate ? new Date(endDate) : undefined,
      eventFilter: eventId || undefined,
      data: reportData,
    });

    res.status(200).json({ message: 'Event report generated', reportId: report._id, ...reportData });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate event report', error: err.message });
  }
};

// GET /api/reports  (Admin and Organizer) — audit history of previously generated reports
const getReportHistory = async (req, res) => {
  try {
    const { reportType } = req.query;
    const filter = {};
    if (reportType) filter.reportType = reportType.toUpperCase();
    if (req.user.role === 'ORGANIZER') {
      filter.generatedBy = req.user.id;
    }

    const reports = await Report.find(filter)
      .populate('generatedBy', 'name email')
      .select('-data')
      .sort({ createdAt: -1 });

    res.status(200).json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch report history', error: err.message });
  }
};

// GET /api/reports/:id  (Admin and Organizer) — view one past report with full data
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate('generatedBy', 'name email');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    if (req.user.role === 'ORGANIZER' && report.generatedBy?._id?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not have access to this report' });
    }
    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch report', error: err.message });
  }
};

module.exports = { generateBookingReport, generateEventReport, getReportHistory, getReportById };