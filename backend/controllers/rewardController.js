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
    let userWinnerVoucher = null;
    let drawObj = null;

    if (draw) {
      drawObj = draw.toObject();
      if (draw.drawStatus === 'COMPLETED') {
        const Voucher = require('../models/Voucher');
        const vouchers = await Voucher.find({ rewardDraw: draw._id }).select('code user discountPercentage isRedeemed');
        drawObj.vouchers = vouchers;
      }
    }

    if (req.user) {
      if (draw) {
        isParticipating = draw.participants.some(
          (p) => (p._id || p).toString() === req.user.id
        );
      }

      // Check if logged-in customer has an unredeemed winner voucher from this event's organizer
      const Voucher = require('../models/Voucher');
      const activeVoucher = await Voucher.findOne({
        user: req.user.id,
        organizer: event.organizer,
        isRedeemed: false,
      }).populate('sourceEvent', 'eventName');

      if (activeVoucher && (!activeVoucher.expiresAt || activeVoucher.expiresAt > new Date())) {
        userWinnerVoucher = {
          code: activeVoucher.code,
          discountPercentage: activeVoucher.discountPercentage,
          sourceEventName: activeVoucher.sourceEvent?.eventName || 'Previous Event',
          expiresAt: activeVoucher.expiresAt,
        };
      }
    }

    res.status(200).json({
      draw: drawObj,
      isParticipating,
      userWinnerVoucher,
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

    const { computeLiveStatus } = require('../utils/eventTiming');
    const liveStatus = computeLiveStatus(event);
    if (event.status === 'COMPLETED' || liveStatus === 'COMPLETED') {
      return res.status(400).json({
        message: 'This event has concluded. Reward campaigns cannot be modified for completed events.',
      });
    }

    const promoTicketPrice = Math.round(event.ticketPrice * (1 - discountPercentage / 100));

    let draw = await RewardDraw.findOne({ event: event._id });
    if (draw) {
      if (draw.drawStatus === 'COMPLETED') {
        return res.status(400).json({
          message: 'Campaign settings cannot be modified because the Lucky Draw has already been completed and winners announced.',
        });
      }
      draw.discountPercentage = discountPercentage;
      draw.promoTicketPrice = promoTicketPrice;
      draw.numberOfWinners = numberOfWinners;
      if (drawDate) draw.drawDate = drawDate;
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
// Execute the Lucky Draw selection algorithm & issue next-booking discount vouchers for same organizer
const executeDraw = async (req, res) => {
  try {
    const draw = await RewardDraw.findById(req.params.id)
      .populate({
        path: 'event',
        populate: { path: 'organizer', select: 'name email' }
      })
      .populate('participants', 'name email');

    if (!draw) {
      return res.status(404).json({ message: 'Reward draw campaign not found' });
    }

    if (req.user.role !== 'ADMIN' && draw.event.organizer._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to conduct this draw' });
    }

    // Prevent re-running already completed draws
    if (draw.drawStatus === 'COMPLETED') {
      return res.status(400).json({
        message: 'The Lucky Draw for this event has already been conducted. Winners have already been selected and vouchers issued. Re-drawing is disabled to preserve winner fairness.',
      });
    }

    // Prevent executing lucky draws for cancelled events
    if (draw.event.status === 'CANCELLED' || draw.event.status === 'DELETED') {
      return res.status(400).json({
        message: 'Cannot execute lucky draw for a cancelled event.',
      });
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

    const organizerName = draw.event.organizer?.name || 'the event organizer';

    // Issue unique winner reward vouchers valid for next booking of this same organizer
    const Voucher = require('../models/Voucher');
    const generatedVouchers = [];

    for (const winner of selectedWinners) {
      let voucher = await Voucher.findOne({
        user: winner._id,
        rewardDraw: draw._id,
      });

      if (!voucher) {
        const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `WIN-${draw.event._id.toString().slice(-4).toUpperCase()}-${randSuffix}`;
        voucher = await Voucher.create({
          code,
          user: winner._id,
          organizer: draw.event.organizer._id,
          sourceEvent: draw.event._id,
          rewardDraw: draw._id,
          discountPercentage: draw.discountPercentage,
          isRedeemed: false,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days validity
        });
      }
      generatedVouchers.push(voucher);
    }

    // Notify winners via notificationService (dispatches email and in-app alert) with voucher details
    const { sendEmailNotification } = require('../services/notificationService');
    await Promise.all(
      selectedWinners.map((winner, idx) => {
        const v = generatedVouchers[idx];
        const vCode = v ? v.code : 'LUCKYDRAW';
        return sendEmailNotification({
          user: winner,
          type: 'DRAW_RESULT',
          message: `🎉 Congratulations! You have won the Lucky Draw for "${draw.event.eventName}"! Host "${organizerName}" has rewarded you with an exclusive ${draw.discountPercentage}% discount voucher on your next event booking with them! Use voucher code "${vCode}" at checkout.`,
        }).catch((e) => console.error('Winner notification failed:', e.message));
      })
    );

    const drawObj = draw.toObject();
    drawObj.vouchers = generatedVouchers;

    res.status(200).json({
      message: `Draw completed! ${winnerCount} winners selected successfully. Discount vouchers issued for next bookings with this organizer.`,
      draw: drawObj,
      winners: selectedWinners,
      vouchers: generatedVouchers,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to execute lucky draw', error: err.message });
  }
};

// POST /api/rewards/apply-promo (Customer)
// Validate promo code, lucky draw code, or personal winner voucher for same organizer
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

    // 1. Check if matching personal winner voucher issued by this event's organizer
    const Voucher = require('../models/Voucher');
    const voucher = await Voucher.findOne({
      code: cleanCode,
      isRedeemed: false,
    }).populate('organizer', 'name email').populate('sourceEvent', 'eventName');

    if (voucher) {
      // Verify account ownership
      if (!req.user || voucher.user.toString() !== req.user.id) {
        return res.status(403).json({
          valid: false,
          message: 'This winner reward voucher belongs to another attendee account.',
        });
      }

      // Verify expiration
      if (voucher.expiresAt && voucher.expiresAt < new Date()) {
        return res.status(400).json({
          valid: false,
          message: 'This winner reward voucher has expired.',
        });
      }

      // Verify event organizer matches the voucher's issuing organizer
      if (event.organizer.toString() !== voucher.organizer._id.toString()) {
        return res.status(400).json({
          valid: false,
          message: `This voucher is exclusively valid for events hosted by "${voucher.organizer.name}". It cannot be used for events by other organizers.`,
        });
      }

      const discountedPrice = Math.round(event.ticketPrice * (1 - voucher.discountPercentage / 100));
      return res.status(200).json({
        valid: true,
        code: voucher.code,
        discountPercentage: voucher.discountPercentage,
        discountedPrice,
        isPromotional: true,
        isWinnerVoucher: true,
        description: `🎉 Lucky Draw Winner Reward: ${voucher.discountPercentage}% Off from organizer "${voucher.organizer.name}" (Won in "${voucher.sourceEvent.eventName}")`,
      });
    }

    // 2. Check if matching static platform voucher
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

    // 3. Check if matching active event Lucky Draw code (e.g. "LUCKYDRAW" or "PROMO")
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
      message: `Invalid or expired promo code "${cleanCode}". Try LUCKY20, EARLYBIRD, or your winner voucher code.`,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to validate promo code', error: err.message });
  }
};

// GET /api/rewards/my-vouchers (Customer)
// Fetch all personal vouchers earned by the logged-in user
const getMyVouchers = async (req, res) => {
  try {
    const Voucher = require('../models/Voucher');
    const vouchers = await Voucher.find({ user: req.user.id })
      .populate('organizer', 'name email')
      .populate('sourceEvent', 'eventName date venue')
      .sort({ createdAt: -1 });

    res.status(200).json(vouchers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch vouchers', error: err.message });
  }
};

module.exports = {
  getEventDraw,
  createOrUpdateDraw,
  executeDraw,
  applyPromoCode,
  getMyVouchers,
};
