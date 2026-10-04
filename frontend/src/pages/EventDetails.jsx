import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as eventService from '../services/eventService';
import * as bookingService from '../services/bookingService';
import * as paymentService from '../services/paymentService';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  ArrowRight,
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  ShieldCheck, 
  Ticket, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Sparkles,
  Lock,
  Tag,
  Percent,
  Check,
  Layers,
  QrCode,
  Download,
  Trophy
} from 'lucide-react';
import QRCode from 'qrcode';
import Button from '../components/ui/Button';
import PaymentModal from '../components/PaymentModal';
import * as rewardService from '../services/rewardService';
import { downloadTicketPdf } from '../utils/ticketPdfGenerator';
import { formatEventDate, formatTime12h, formatTimeRange12h, formatTimestampTime, formatEventSchedule, isEventStarted, isEventPastEnd } from '../utils/dateTime';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Checkout state
  const [selectedTier, setSelectedTier] = useState(null);
  const [ticketCount, setTicketCount] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState('');

  // Payment modal state
  const [activeBooking, setActiveBooking] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [successQr, setSuccessQr] = useState('');

  // Promo code & Lucky Draw state
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [eventDraw, setEventDraw] = useState(null);
  const [userWinnerVoucher, setUserWinnerVoucher] = useState(null);

  // Restrict ORGANIZER and ADMIN from accessing customer event booking page
  useEffect(() => {
    if (user?.role === 'ORGANIZER') {
      navigate('/organizer/events', { replace: true });
    } else if (user?.role === 'ADMIN') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (bookingSuccess) {
      const existing = bookingSuccess.qrCode || activeBooking?.qrCode;
      if (existing) {
        setSuccessQr(existing);
      } else if (bookingSuccess._id) {
        QRCode.toDataURL(bookingSuccess._id.toString(), { errorCorrectionLevel: 'H', margin: 1, width: 320 })
          .then(setSuccessQr)
          .catch(() => {});
      }
    }
  }, [bookingSuccess, activeBooking]);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await eventService.getEventById(id);
        setEvent(data);
        if (data.ticketTiers && data.ticketTiers.length > 0) {
          const firstAvailable = data.ticketTiers.find((t) => t.availableSeats > 0) || data.ticketTiers[0];
          setSelectedTier(firstAvailable);
        }
      } catch {
        setError('Failed to load event details. Please verify the link or try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();

    rewardService.getEventDraw(id).then((res) => {
      if (res.data?.draw && res.data.draw.drawStatus === 'OPEN') {
        setEventDraw(res.data.draw);
      }
      if (res.data?.userWinnerVoucher) {
        setUserWinnerVoucher(res.data.userWinnerVoucher);
      }
    }).catch(() => {});
  }, [id]);

  const handleApplyPromo = async (codeToApply) => {
    const code = codeToApply || promoCode;
    if (!code || !code.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const { data } = await rewardService.applyPromoCode({
        code: code.trim(),
        eventId: event._id,
      });
      setAppliedPromo(data);
      setPromoCode(data.code);
    } catch (err) {
      setPromoError(err.response?.data?.message || 'Invalid or expired promo code.');
      setAppliedPromo(null);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };


  const isEventCancelled = event?.status === 'CANCELLED' || event?.status === 'DELETED';
  const isEventCompleted = event ? (event.status === 'COMPLETED' || (!isEventCancelled && isEventPastEnd(event))) : false;
  const isEventOngoing = event ? (!isEventCancelled && !isEventCompleted && (event.status === 'ONGOING' || isEventStarted(event))) : false;
  const isBookingClosed = isEventCancelled || isEventCompleted || isEventOngoing;

  const maxAvailable = selectedTier ? selectedTier.availableSeats : (event?.availableSeats || 1);

  const handleQuantityChange = (delta) => {
    const maxAllowed = Math.min(10, maxAvailable);
    setTicketCount((prev) => Math.max(1, Math.min(maxAllowed, prev + delta)));
  };

  const handleBooking = async () => {
    if (isBookingClosed) {
      setBookingError(
        isEventCancelled
          ? 'This event has been cancelled by the host.'
          : isEventOngoing
          ? 'This event has already started. Ticket bookings and payments are closed.'
          : 'This event has concluded. Ticket bookings and payments are closed.'
      );
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role !== 'CUSTOMER') {
      setBookingError('Only Customer accounts can book tickets. Please switch accounts.');
      return;
    }

    setBookingLoading(true);
    setBookingError('');

    try {
      // 1. Create booking (holds seats for 10 minutes)
      const { data: bookingRes } = await bookingService.bookTicket({
        eventId: event._id,
        ticketCount,
        isPromotional: Boolean(appliedPromo?.isPromotional),
        promoCode: appliedPromo?.code,
        tierName: selectedTier?.tierName,
      });

      const booking = { ...bookingRes.booking, event };
      setActiveBooking(booking);
      setIsPaymentOpen(true);
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Could not complete booking. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setIsPaymentOpen(false);
    setBookingSuccess({ ...activeBooking, bookingStatus: 'CONFIRMED' });
  };

  if (user?.role === 'ORGANIZER' || user?.role === 'ADMIN') {
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 text-sm">Loading event details...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto text-2xl">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-white">Event Not Found</h2>
        <p className="text-slate-400 text-xs">{error || 'This event does not exist or has been removed.'}</p>
        <Link to="/" className="inline-block mt-2">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to All Events
          </Button>
        </Link>
      </div>
    );
  }

  const baseTicketPrice = selectedTier ? selectedTier.price : (event.ticketPrice || 0);
  const maxAvailableSeats = selectedTier ? selectedTier.availableSeats : (event.availableSeats || 0);
  const discountPercent = appliedPromo?.discountPercentage || 0;
  const effectiveTicketPrice = appliedPromo 
    ? Math.round(baseTicketPrice * (1 - discountPercent / 100))
    : baseTicketPrice;
  const originalSubtotal = baseTicketPrice * ticketCount;
  const discountedSubtotal = effectiveTicketPrice * ticketCount;
  const discountSavings = originalSubtotal - discountedSubtotal;
  const platformFee = Math.round(discountedSubtotal * 0.05);
  const totalAmount = discountedSubtotal + platformFee;

  const eventDate = formatEventDate(event.date);

  return (
    <div className="min-h-screen pb-20 pt-6 px-4 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
      
      {/* Top Breadcrumb */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Browse Events</span>
        </Link>
      </div>

      {/* Main Grid: Left Details, Right Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Col: Event Showcase */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Hero Banner Image */}
          {event.bannerImage && (
            <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl h-64 md:h-80 w-full group">
              <img
                src={event.bannerImage.startsWith('http') ? event.bannerImage : `http://localhost:5001${event.bannerImage}`}
                alt={event.eventName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
            </div>
          )}

          {/* Header Banner */}
          <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {event.category}
                </span>
                {isEventCancelled ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>CANCELLED</span>
                  </span>
                ) : isEventCompleted ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>COMPLETED</span>
                  </span>
                ) : isEventOngoing ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                    <span>ONGOING • IN PROGRESS</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ACTIVE</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight">
                {event.eventName}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-300 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>{eventDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>{formatEventSchedule(event.time, event.duration, event.endTime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Tabs & Overview */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 md:p-8 space-y-6 glass-card">
            
            {/* Host Lucky Draw Campaign Feature Callout */}
            {eventDraw && !isBookingClosed && (
              <div className="p-4.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-amber-300">
                      Host Promotional Lucky Draw: Win {eventDraw.discountPercentage}% OFF Next Booking
                    </h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Active Campaign
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Book passes for this event to get enrolled in the host's lucky draw! {eventDraw.numberOfWinners || 2} lucky attendees will be chosen to win a {eventDraw.discountPercentage}% discount voucher for their next booking with this organizer.
                </p>
                <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-amber-300/90">
                  <span>Apply promo code <strong className="text-white bg-slate-900/80 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">LUCKYDRAW</strong> at checkout.</span>
                  <span className="text-[10px] text-amber-400/90 italic font-medium">
                    * Note: The organizer reserves the right to modify this offer prior to the event.
                  </span>
                </div>
              </div>
            )}

            {/* Description & Overview */}
            {event.description && (
              <div className="space-y-3 pb-6 border-b border-slate-800/80">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <span>About This Event</span>
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed pl-7 whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            )}

            {/* Venue & Location */}
            <div className="space-y-3 pb-6 border-b border-slate-800/80">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <span>Venue & Location</span>
              </h3>
              <p className="text-sm text-slate-300 pl-7">{event.venue}</p>
            </div>

            {/* Organizer Info */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                <span>Hosted By</span>
              </h3>
              <div className="pl-7 text-sm">
                <p className="font-semibold text-white">{event.organizer?.name || 'Verified Event Organizer'}</p>
              </div>
            </div>

          </div>

        </div>

        {/* Right Col: Ticket Booking Widget / Booking Closed Overview */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          
          {isBookingClosed ? (
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl glass-card space-y-5">
              {/* Status Notice Banner */}
              <div className={`p-4 rounded-2xl border ${
                isEventCancelled
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                  : isEventOngoing
                  ? 'bg-purple-500/10 border-purple-500/25 text-purple-200'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
              } space-y-2`}>
                <div className="flex items-center gap-2">
                  {isEventCancelled ? (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  ) : isEventOngoing ? (
                    <span className="relative flex h-3.5 w-3.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-purple-500"></span>
                    </span>
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                  <h3 className="font-extrabold text-sm text-white">
                    {isEventCancelled
                      ? 'Event Cancelled'
                      : isEventOngoing
                      ? 'Event In Progress (Live Now)'
                      : 'Event Concluded'}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isEventCancelled
                    ? 'This event has been cancelled by the organizer. Ticket bookings, promotional vouchers, and payment processing are closed.'
                    : isEventOngoing
                    ? 'This event has already started. Ticket reservations, promotional discounts, and payment processing closed at the scheduled start time.'
                    : 'This event has ended. Ticket bookings, promotional vouchers, and payments are no longer available.'}
                </p>
              </div>

              {/* Event Schedule & Details Summary */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Event Schedule & Overview
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Date
                    </span>
                    <span className="font-semibold text-white">{eventDate}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" /> Schedule
                    </span>
                    <span className="font-semibold text-white">{formatEventSchedule(event.time, event.duration, event.endTime)}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Venue
                    </span>
                    <span className="font-semibold text-white text-right truncate max-w-[180px]">{event.venue}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-purple-400" /> Host
                    </span>
                    <span className="font-semibold text-white truncate max-w-[180px]">{event.organizer?.name || 'Verified Host'}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-indigo-400" /> Ticket Price
                    </span>
                    <span className="font-extrabold text-white">₹{(event.ticketPrice || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Direct to live events */}
              <div className="pt-2">
                <Link to="/" className="block">
                  <Button variant="gradient" size="lg" className="w-full">
                    <span>Explore Live Upcoming Events</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl glass-card space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {selectedTier ? selectedTier.tierName : 'Standard Admission'}
                </span>
                <span className="text-2xl font-black text-white mt-0.5 block">
                  ₹{baseTicketPrice.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                {maxAvailableSeats} seats left
              </span>
            </div>

            {/* Pass Tier Selector if event has tiers, or Standard Pass if no tiers */}
            {event.ticketTiers && event.ticketTiers.length > 0 ? (
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Choose Pass Tier</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">{event.ticketTiers.length} Options</span>
                </label>
                <div className="space-y-2">
                  {event.ticketTiers.map((tier) => {
                    const isSelected = selectedTier?.tierName === tier.tierName;
                    const isSoldOut = tier.availableSeats <= 0;
                    return (
                      <div
                        key={tier.tierName}
                        onClick={() => {
                          if (!isSoldOut) {
                            setSelectedTier(tier);
                            if (ticketCount > tier.availableSeats) {
                              setTicketCount(Math.max(1, tier.availableSeats));
                            }
                          }
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/50'
                            : isSoldOut
                            ? 'bg-slate-950/40 border-slate-800/50 opacity-40 cursor-not-allowed'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className="text-xs font-bold text-white">{tier.tierName}</span>
                          </div>
                          <span className="text-sm font-extrabold text-white">
                            ₹{tier.price.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {tier.perks && (
                          <p className="text-[11px] text-indigo-300/80 pl-5.5 mt-1 font-medium">
                            ✨ {tier.perks}
                          </p>
                        )}

                        <div className="flex items-center justify-between pl-5.5 mt-1 text-[10px]">
                          <span className={isSoldOut ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                            {isSoldOut ? 'Sold Out' : `${tier.availableSeats} passes left`}
                          </span>
                          {tier.totalSeats && !isSoldOut && (
                            <span className="text-slate-500">Cap: {tier.totalSeats}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                    Standard Admission
                  </span>
                  <span className="text-[11px] font-bold text-indigo-400">Single Tier</span>
                </div>
                <p className="text-[11px] text-slate-400 pl-3.5">
                  General pass with full event access and guaranteed entry.
                </p>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Select Quantity</label>
              <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-medium text-slate-400 pl-2">Passes (Max 10)</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={ticketCount <= 1}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center justify-center transition cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-extrabold text-white text-base w-6 text-center">
                    {ticketCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(1)}
                    disabled={ticketCount >= event.availableSeats || ticketCount >= 10}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center justify-center transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Promo Code & Lucky Draw Discount Drawer */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Promo Code & Lucky Rewards</span>
                </span>
                {appliedPromo && (
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Applied
                  </span>
                )}
              </label>

              {appliedPromo ? (
                <div className={`p-3.5 rounded-2xl ${appliedPromo.isContestEntry ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/25'} border text-xs space-y-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {appliedPromo.isContestEntry ? (
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span className={`font-bold font-mono text-sm ${appliedPromo.isContestEntry ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {appliedPromo.code}
                      </span>
                      {appliedPromo.isContestEntry ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          CONTEST ENTRY
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {appliedPromo.discountPercentage}% OFF
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300">{appliedPromo.description}</p>
                  {(appliedPromo.isContestEntry || appliedPromo.code === 'LUCKYDRAW') && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="block text-amber-300 font-semibold">Enrolled in Lucky Draw Contest!</strong>
                        <span>Current pass is charged at regular price. If selected in the host draw, you will win a <strong>{appliedPromo.nextBookingDiscount || eventDraw?.discountPercentage}% OFF voucher</strong> for your next booking with this host!</span>
                        <p className="text-[10px] text-amber-300/80 italic font-medium pt-0.5">
                          * Note: The organizer reserves the right to modify this offer prior to the event.
                        </p>
                      </div>
                    </div>
                  )}
                  {appliedPromo.code === 'EARLYBIRD' && (
                    <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-center gap-2">
                      <span className="text-sm">🐦</span>
                      <span><strong>15% Early Bird Savings Activated!</strong></span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="e.g. LUCKYDRAW or EARLYBIRD"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono uppercase placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={promoLoading}
                      onClick={() => handleApplyPromo()}
                      className="cursor-pointer shrink-0"
                    >
                      Apply
                    </Button>
                  </div>

                  {/* 1-Click Available Deal Cards */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Tap to Apply Active Deals:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {userWinnerVoucher && (
                        <button
                          type="button"
                          onClick={() => handleApplyPromo(userWinnerVoucher.code)}
                          className="w-full p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-400/40 text-left text-xs transition cursor-pointer flex items-center justify-between group shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                              <span className="font-bold text-amber-300 block">{userWinnerVoucher.code}</span>
                              <span className="text-[10px] text-slate-300">{userWinnerVoucher.discountPercentage}% Off Organizer Winner Reward</span>
                              <span className="text-[9px] text-amber-300/70 block mt-0.5">* Organizer reserves the right to modify voucher terms</span>
                            </div>
                          </div>
                          <span className="text-[11px] font-black text-amber-400 group-hover:underline">Apply</span>
                        </button>
                      )}
                      {eventDraw && (
                        <button
                          type="button"
                          onClick={() => handleApplyPromo('LUCKYDRAW')}
                          className="w-full p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left text-xs transition cursor-pointer flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                              <span className="font-bold text-amber-300 block">LUCKYDRAW</span>
                              <span className="text-[10px] text-slate-400">Contest Entry • Win {eventDraw.discountPercentage}% Off Next Booking</span>
                              <span className="text-[9px] text-amber-400/80 block mt-0.5 font-medium">* Organizer reserves the right to modify this offer</span>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-amber-400 group-hover:underline">Apply</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleApplyPromo('EARLYBIRD')}
                        className="w-full p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left text-xs transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🐦</span>
                          <div>
                            <span className="font-bold text-emerald-300 block">EARLYBIRD</span>
                            <span className="text-[10px] text-slate-400">15% Off Early Bird Advance Booking</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-400 group-hover:underline">Apply</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPromo('LUCKY20')}
                        className="w-full p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-left text-xs transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div>
                            <span className="font-bold text-indigo-300 block">LUCKY20</span>
                            <span className="text-[10px] text-slate-400">20% Off Platform Welcome Voucher</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-400 group-hover:underline">Apply</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {promoError && (
                <p className="text-[10px] text-rose-400">{promoError}</p>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Pass Subtotal ({ticketCount}x)</span>
                <span className={`font-semibold ${discountSavings > 0 ? 'line-through text-slate-500' : 'text-white'}`}>
                  ₹{originalSubtotal.toLocaleString('en-IN')}
                </span>
              </div>
              {discountSavings > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Promotional Discount</span>
                  </span>
                  <span className="font-bold">-₹{discountSavings.toLocaleString('en-IN')}</span>
                </div>
              )}
              {appliedPromo?.isContestEntry && (
                <div className="flex justify-between text-amber-300 text-[11px] py-0.5">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Lucky Draw Contest</span>
                  </span>
                  <span className="font-semibold text-amber-300">Enrolled (Win {appliedPromo.nextBookingDiscount}% Off Next)</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Platform & GST (5%)</span>
                <span className="font-semibold text-white">₹{platformFee.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-slate-800 text-sm font-bold">
                <span className="text-white">Total Amount</span>
                <span className="text-indigo-400 text-lg font-extrabold">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {bookingError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{bookingError}</span>
              </div>
            )}

            {/* Checkout CTA */}
            <div className="space-y-2 pt-1">
              <Button
                variant="gradient"
                size="lg"
                loading={bookingLoading}
                onClick={handleBooking}
                className="w-full"
              >
                <Ticket className="w-4 h-4 mr-2" />
                <span>{user ? 'Proceed to Book & Pay' : 'Sign in to Book Ticket'}</span>
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Seats locked for 10 minutes upon booking</span>
              </div>
            </div>

          </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>Guaranteed genuine ticket pass with QR gate verification.</span>
          </div>

        </div>

      </div>

      {/* Booking Success Dialog */}
      {bookingSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-indigo-500/30 p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl border border-emerald-500/30">
              ✓
            </div>
            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-white">Booking Confirmed!</h3>
              <p className="text-slate-400 text-xs">
                Your passes for <span className="text-white font-semibold">{event.eventName}</span> have been issued and saved to your wallet.
              </p>
            </div>
            {/* Scannable Pass QR Code */}
            {successQr ? (
              <div className="p-4 bg-white rounded-2xl shadow-xl max-w-[210px] mx-auto text-center space-y-1.5">
                <img
                  src={successQr}
                  alt="Pass Entry QR Code"
                  className="w-40 h-40 mx-auto object-contain"
                />
                <span className="block text-[11px] font-mono font-bold text-slate-800 tracking-wider">
                  #BKG-{(bookingSuccess._id || activeBooking?._id || '').slice(-6).toUpperCase()}
                </span>
                <span className="block text-[9px] uppercase tracking-wider text-indigo-600 font-bold">
                  FAST-TRACK GATE ENTRY
                </span>
              </div>
            ) : (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl max-w-[180px] mx-auto text-center text-slate-400 text-xs">
                <QrCode className="w-8 h-8 text-indigo-400 mx-auto mb-1 animate-pulse" />
                Generating QR Pass...
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Passes:</span>
                <span className="font-bold text-white">{ticketCount} Tickets</span>
              </div>
              {(bookingSuccess?.tierName || selectedTier?.tierName) && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Pass Tier:</span>
                  <span className="font-bold text-indigo-300">
                    {bookingSuccess?.tierName || selectedTier?.tierName}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Total Paid:</span>
                <span className="font-bold text-indigo-400">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Booking Time:</span>
                <span className="font-bold text-slate-200 font-mono">
                  {bookingSuccess?.bookingTime ? formatTime12h(bookingSuccess.bookingTime) : formatTimestampTime(new Date())}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                variant="gradient"
                size="md"
                onClick={() =>
                  downloadTicketPdf({
                    booking: bookingSuccess,
                    event,
                    user,
                    qrCodeDataUrl: successQr || bookingSuccess?.qrCode,
                  })
                }
                className="w-full flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25"
              >
                <Download className="w-4 h-4" />
                <span>Download Ticket Pass (PDF)</span>
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => navigate('/my-bookings')}
                className="w-full flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View in My Bookings</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBookingSuccess(null)}
                className="w-full text-slate-400 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Payment Gateway Modal */}
      {isPaymentOpen && activeBooking && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          booking={activeBooking}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={() => {}}
        />
      )}

    </div>
  );
}

