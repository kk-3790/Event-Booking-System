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
  Sparkles,
  Lock,
  Gift,
  Tag,
  Percent,
  Check
} from 'lucide-react';
import Button from '../components/ui/Button';
import PaymentModal from '../components/PaymentModal';
import * as rewardService from '../services/rewardService';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Checkout state
  const [ticketCount, setTicketCount] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState('');

  // Payment modal state
  const [activeBooking, setActiveBooking] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Promo code & Lucky Draw state
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [eventDraw, setEventDraw] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await eventService.getEventById(id);
        setEvent(data);
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


  const handleQuantityChange = (delta) => {
    const maxAllowed = Math.min(10, event?.availableSeats || 1);
    setTicketCount((prev) => Math.max(1, Math.min(maxAllowed, prev + delta)));
  };

  const handleBooking = async () => {
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
    
    // Automatically redirect to My Bookings after 1.5s so attendee sees their ticket pass
    setTimeout(() => {
      navigate('/my-bookings', { 
        state: { 
          paymentToast: `🎉 Payment confirmed! Passes for "${event.eventName}" are issued to your wallet.` 
        } 
      });
    }, 1500);
  };

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

  const effectiveTicketPrice = appliedPromo ? appliedPromo.discountedPrice : event.ticketPrice;
  const originalSubtotal = event.ticketPrice * ticketCount;
  const discountedSubtotal = effectiveTicketPrice * ticketCount;
  const discountSavings = originalSubtotal - discountedSubtotal;
  const platformFee = Math.round(discountedSubtotal * 0.05);
  const totalAmount = discountedSubtotal + platformFee;

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
          
          {/* Header Banner */}
          <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {event.category}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{event.status}</span>
                </span>
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
                  <span>{event.time} – {event.endTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Tabs & Overview */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 md:p-8 space-y-6 glass-card">
            
            {/* Venue & Location */}
            <div className="space-y-3 pb-6 border-b border-slate-800/80">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <span>Venue & Location</span>
              </h3>
              <p className="text-sm text-slate-300 pl-7">{event.venue}</p>
            </div>

            {/* Organizer Info */}
            <div className="space-y-3 pb-6 border-b border-slate-800/80">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                <span>Hosted By</span>
              </h3>
              <div className="pl-7 text-sm">
                <p className="font-semibold text-white">{event.organizer?.name || 'Verified Event Organizer'}</p>
                {event.organizer?.email && (
                  <p className="text-xs text-slate-400 mt-0.5">{event.organizer.email}</p>
                )}
              </div>
            </div>

            {/* Experience Highlights */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-400" />
                <span>What to Expect</span>
              </h3>
              <ul className="text-xs md:text-sm text-slate-300 space-y-2 pl-7 list-disc">
                <li>Instant QR entry pass issued upon payment confirmation.</li>
                <li>Reserved seat confirmation with guaranteed admission.</li>
                <li>10-minute seat lock applied upon initiating checkout.</li>
                <li>Cancel anytime up to event start time for full seat release.</li>
              </ul>
            </div>

          </div>

        </div>

        {/* Right Col: Ticket Booking Widget */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl glass-card space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Admission Pass
                </span>
                <span className="text-2xl font-black text-white mt-0.5 block">
                  ₹{event.ticketPrice.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                {event.availableSeats} seats left
              </span>
            </div>

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
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-bold text-emerald-300 block">{appliedPromo.code}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{appliedPromo.description}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="e.g. LUCKY20 or LUCKYDRAW"
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

                  {/* Quick Voucher Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyPromo('LUCKY20')}
                      className="px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-[10px] font-semibold text-indigo-300 transition cursor-pointer"
                    >
                      LUCKY20 (20% Off)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPromo('EARLYBIRD')}
                      className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-semibold text-emerald-300 transition cursor-pointer"
                    >
                      EARLYBIRD (15% Off)
                    </button>
                    {eventDraw && (
                      <button
                        type="button"
                        onClick={() => handleApplyPromo('LUCKYDRAW')}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-semibold text-amber-300 transition cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        <span>LUCKYDRAW ({eventDraw.discountPercentage}% Off + Draw)</span>
                      </button>
                    )}
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
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Passes:</span>
                <span className="font-bold text-white">{ticketCount} Tickets</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Paid:</span>
                <span className="font-bold text-indigo-400">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Booking Time:</span>
                <span className="font-bold text-slate-200 font-mono">
                  {bookingSuccess?.bookingTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                variant="gradient"
                size="md"
                onClick={() => navigate('/my-bookings')}
                className="w-full"
              >
                <span>View in My Bookings</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBookingSuccess(null)}
                className="w-full text-slate-400"
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

