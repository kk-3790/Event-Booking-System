const RewardDraw = require('../models/RewardDraw');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Standard verified platform promo vouchers
const STATIC_PROMOS = {
  'LUCKY20': { discountPercentage: 20, description: '20% Platform Lucky Voucher' },
  'EARLYBIRD': { discountPercentage: 15, description: '15% Early Bird Discount' },
  'VIP50': { discountPercentage: 50, description: '50% VIP Exclusive Pass' },
  'EVENTHUB10': { discountPercentage: 10, description: '10% Welcome Discount' },
};

// GET /api/rewards/event/:eventId
// Retrieve active Reward Draw & Lucky Discount configuration for an event
const getEventDraw = async (req, res) => {
  try {
    const draw = await RewardDraw.findOne({ event: req.params.eventId })
      .populate('participants', 'name email')
      .populate('winners', 'name email');

    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    let isParticipating = false;
    if (req.user && draw) {
      isParticipating = draw.participants.some(
        (p) => (p._id || p).toString() === req.user.id
      );
    }

    res.status(200).json({
      draw: draw || null,
      isParticipating,
      availablePromos: Object.keys(STATIC_PROMOS).map((k) => ({
        code: k,
        discountPercentage: STATIC_PROMOS[k].discountPercentage,
        description: STATIC_PROMOS[k].description,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reward draw', error: err.message });
  }
};

// POST /api/rewards/event/:eventId  (Organizer or Admin)
// Create or update a Lucky Draw / Promotional Discount campaign for an event
const createOrUpdateDraw = async (req, res) => {
  try {
    const { discountPercentage, numberOfWinners, drawDate } = req.body;

    if (!discountPercentage || discountPercentage < 1 || discountPercentage > 90) {
      return res.status(400).json({ message: 'Discount percentage must be between 1% and 90%' });
    }
    if (!numberOfWinners || numberOfWinners < 1) {
      return res.status(400).json({ message: 'Number of winners must be at least 1' });
    }

    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (req.user.role !== 'ADMIN' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the organizer can configure promotional rewards for this event' });
    }

    const promoTicketPrice = Math.round(event.ticketPrice * (1 - discountPercentage / 100));

    let draw = await RewardDraw.findOne({ event: event._id });
    if (draw) {
      draw.discountPercentage = discountPercentage;
      draw.promoTicketPrice = promoTicketPrice;
      draw.numberOfWinners = numberOfWinners;
      if (drawDate) draw.drawDate = drawDate;
      if (draw.drawStatus === 'COMPLETED') draw.drawStatus = 'OPEN';
      await draw.save();
    } else {
      draw = await RewardDraw.create({
        event: event._id,
        discountPercentage,
        promoTicketPrice,
        numberOfWinners,
        drawStatus: 'OPEN',
        drawDate: drawDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    res.status(200).json({
      message: 'Lucky promotional reward configured successfully',
      draw,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to configure reward draw', error: err.message });
  }
};

// POST /api/rewards/draw/:id  (Organizer or Admin)
// Execute the Lucky Draw selection algorithm
const executeDraw = async (req, res) => {
  try {
    const draw = await RewardDraw.findById(req.params.id)
      .populate('event')
      .populate('participants', 'name email');

    if (!draw) {
      return res.status(404).json({ message: 'Reward draw campaign not found' });
    }

    if (req.user.role !== 'ADMIN' && draw.event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to conduct this draw' });
    }

    if (!draw.participants || draw.participants.length === 0) {
      return res.status(400).json({ message: 'No participants enrolled in this draw yet' });
    }

    // Shuffle participants randomly (Fisher-Yates)
    const pool = [...draw.participants];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Pick winners up to numberOfWinners
    const winnerCount = Math.min(draw.numberOfWinners, pool.length);
    const selectedWinners = pool.slice(0, winnerCount);

    draw.winners = selectedWinners.map((w) => w._id);
    draw.drawStatus = 'COMPLETED';
    draw.drawDate = new Date();
    await draw.save();

    // Notify winners via notificationService (dispatches email and in-app alert)
    const { sendEmailNotification } = require('../services/notificationService');
    await Promise.all(
      selectedWinners.map((winner) =>
        sendEmailNotification({
          user: winner,
          type: 'DRAW_RESULT',
          message: `🎉 Congratulations! You have won the Lucky Draw for "${draw.event.eventName}"! Your promotional perk is confirmed.`,
        }).catch((e) => console.error('Winner notification failed:', e.message))
      )
    );

    res.status(200).json({
      message: `Draw completed! ${winnerCount} winners selected successfully.`,
      draw,
      winners: selectedWinners,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to execute lucky draw', error: err.message });
  }
};

// POST /api/rewards/apply-promo (Customer)
// Validate promo code or event lucky draw opt-in
const applyPromoCode = async (req, res) => {
  try {
    const { code, eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ message: 'eventId is required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const cleanCode = (code || '').trim().toUpperCase();

    // 1. Check if matching static platform voucher
    if (STATIC_PROMOS[cleanCode]) {
      const promo = STATIC_PROMOS[cleanCode];
      const discountedPrice = Math.round(event.ticketPrice * (1 - promo.discountPercentage / 100));
      return res.status(200).json({
        valid: true,
        code: cleanCode,
        discountPercentage: promo.discountPercentage,
        discountedPrice,
        isPromotional: true,
        description: promo.description,
      });
    }

    // 2. Check if matching active event Lucky Draw code (e.g. "LUCKYDRAW" or "PROMO")
    const draw = await RewardDraw.findOne({ event: eventId, drawStatus: 'OPEN' });
    if (draw && (cleanCode === 'LUCKYDRAW' || cleanCode === 'LUCKY' || cleanCode === 'DRAW')) {
      return res.status(200).json({
        valid: true,
        code: cleanCode,
        discountPercentage: draw.discountPercentage,
        discountedPrice: draw.promoTicketPrice,
        isPromotional: true,
        description: `Official ${draw.discountPercentage}% Event Lucky Draw Entry`,
      });
    }

    return res.status(400).json({
      valid: false,
      message: `Invalid or expired promo code "${cleanCode}". Try LUCKY20, EARLYBIRD, or LUCKYDRAW.`,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to validate promo code', error: err.message });
  }
};

module.exports = {
  getEventDraw,
  createOrUpdateDraw,
  executeDraw,
  applyPromoCode,
};
