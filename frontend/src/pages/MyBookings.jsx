import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as bookingService from '../services/bookingService';
import * as paymentService from '../services/paymentService';
import { useAuth } from '../context/AuthContext';
import { 
  Ticket, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  XCircle, 
  QrCode, 
  ArrowRight, 
  ShieldCheck, 
  RotateCcw,
  Lock,
  CreditCard,
  Hourglass,
  Sparkles,
  Maximize2,
  Download
} from 'lucide-react';
import QRCode from 'qrcode';
import Button from '../components/ui/Button';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import { downloadTicketPdf, downloadQrImage } from '../utils/ticketPdfGenerator';

// Countdown Timer Component for PENDING bookings
function ExpiryCountdown({ expiresAt, onExpire }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const calcTime = () => {
      const now = new Date().getTime();
      const target = new Date(expiresAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('00s (Expired)');
        setIsExpired(true);
        if (onExpire) {
          onExpire();
        }
      } else {
        const totalSecs = Math.ceil(diff / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeLeft(mins > 0 ? `${mins}m ${secs < 10 ? '0' : ''}${secs}s` : `${secs}s left`);
        setIsExpired(false);
      }
    };

    calcTime();
    const interval = setInterval(calcTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (!expiresAt) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${
      isExpired 
        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
        : 'bg-amber-500/20 text-amber-300 border border-amber-400/30 animate-pulse'
    }`}>
      <Hourglass className="w-3.5 h-3.5" />
      <span>{timeLeft}</span>
    </span>
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Restrict ORGANIZER and ADMIN from accessing customer bookings page
  useEffect(() => {
    if (user?.role === 'ORGANIZER') {
      navigate('/organizer/events', { replace: true });
    } else if (user?.role === 'ADMIN') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  if (user?.role === 'ORGANIZER' || user?.role === 'ADMIN') {
    return null;
  }
  
  // Filter tab: 'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED'
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Payment & Receipt modal state
  const [payingBooking, setPayingBooking] = useState(null);
  const [receiptBooking, setReceiptBooking] = useState(null);
  const [paymentToast, setPaymentToast] = useState('');
  const [clientQrMap, setClientQrMap] = useState({});
  const [enlargedQrBooking, setEnlargedQrBooking] = useState(null);
  useEffect(() => {
    if (location.state?.paymentToast) {
      setPaymentToast(location.state.paymentToast);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await bookingService.getMyBookings();
      setBookings(data || []);
    } catch {
      setError('Failed to fetch your bookings. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Backfill/ensure client QR codes for instant rendering
  useEffect(() => {
    bookings.forEach((b) => {
      if (!b.qrCode && b._id && !clientQrMap[b._id]) {
        QRCode.toDataURL(b._id.toString(), { errorCorrectionLevel: 'H', margin: 1, width: 320 })
          .then((url) => {
            setClientQrMap((prev) => ({ ...prev, [b._id]: url }));
          })
          .catch(() => {});
      }
    });
  }, [bookings, clientQrMap]);

  const handlePaymentSuccess = () => {
    if (payingBooking) {
      setBookings((prev) =>
        prev.map((b) => (b._id === payingBooking._id ? { ...b, bookingStatus: 'CONFIRMED' } : b))
      );
      setPaymentToast(`Payment verified! Pass for ${payingBooking.event?.eventName} is now confirmed.`);
      setPayingBooking(null);
    }
  };

  // Expiry helper functions (presents expired bookings under Cancelled in customer section for presence)
  const isBookingExpired = (b) => {
    if (!b) return false;
    if (b.bookingStatus === 'CONFIRMED') return false;
    if (b.bookingStatus === 'EXPIRED') return true;
    if (b.bookingStatus === 'PENDING' && b.expiresAt) {
      return new Date(b.expiresAt).getTime() <= Date.now();
    }
    return false;
  };

  const isCustomerCancelledOrExpired = (b) => {
    if (!b) return false;
    if (b.bookingStatus === 'CONFIRMED') return false;
    return b.bookingStatus === 'CANCELLED' || isBookingExpired(b);
  };

  const confirmedCount = bookings.filter((b) => b.bookingStatus === 'CONFIRMED').length;
  const pendingCount = bookings.filter((b) => b.bookingStatus === 'PENDING' && !isBookingExpired(b)).length;
  const cancelledCount = bookings.filter((b) => isCustomerCancelledOrExpired(b)).length;

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'CONFIRMED') return b.bookingStatus === 'CONFIRMED';
    if (statusFilter === 'PENDING') return b.bookingStatus === 'PENDING' && !isBookingExpired(b);
    if (statusFilter === 'CANCELLED') return isCustomerCancelledOrExpired(b);
    return b.bookingStatus === statusFilter;
  });

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 lg:px-8 max-w-6xl mx-auto w-full space-y-8">
      
      {/* Toast Notification */}
      {paymentToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{paymentToast}</span>
          </div>
          <button onClick={() => setPaymentToast('')} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold mb-2">
            <Ticket className="w-3.5 h-3.5 text-emerald-400" />
            <span>Digital Ticket Wallet</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            My Booked Passes
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Access your verified entry tickets, QR gate codes, and booking receipts
          </p>
        </div>

        <Link to="/">
          <Button variant="secondary" size="sm">
            <span>Explore More Events</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </Link>
      </div>

      {/* Wallet Status Overview Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-900/60 rounded-2xl border border-slate-800 glass-card text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Passes ({bookings.length})
          </button>
          <button
            onClick={() => setStatusFilter('CONFIRMED')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
              statusFilter === 'CONFIRMED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Confirmed ({confirmedCount})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Payment ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('CANCELLED')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
              statusFilter === 'CANCELLED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cancelled ({cancelledCount})
          </button>
        </div>

        <button
          onClick={fetchBookings}
          className="flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-white transition cursor-pointer"
          title="Refresh bookings"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchBookings} className="underline font-semibold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="rounded-3xl bg-slate-900/40 border border-slate-800 p-8 h-48 animate-pulse"></div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBookings.length === 0 && (
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800 max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto text-2xl">
            🎟️
          </div>
          <h3 className="text-lg font-bold text-white">No passes found</h3>
          <p className="text-slate-400 text-xs">
            {statusFilter === 'ALL'
              ? 'You have not booked any tickets yet. Explore upcoming experiences and book your first pass!'
              : `You have no bookings matching the "${statusFilter}" status.`}
          </p>
          <Link to="/">
            <Button variant="gradient" size="sm" className="mt-2">
              Browse Live Events
            </Button>
          </Link>
        </div>
      )}

      {/* Bookings List */}
      {!loading && filteredBookings.length > 0 && (
        <div className="space-y-6">
          {filteredBookings.map((booking) => {
            const event = booking.event || {};
            const isConfirmed = booking.bookingStatus === 'CONFIRMED';
            const isExpired = !isConfirmed && isBookingExpired(booking);
            const isPending = !isConfirmed && booking.bookingStatus === 'PENDING' && !isExpired;
            const isCancelled = !isConfirmed && isCustomerCancelledOrExpired(booking);

            const isEventCancelled = !isConfirmed && (booking.bookingStatus === 'CANCELLED' || event.status === 'CANCELLED') && (
              booking.cancellationReason?.toLowerCase().includes('event cancelled') ||
              booking.cancellationReason?.toLowerCase().includes('organizer') ||
              booking.cancellationReason?.toLowerCase().includes('host') ||
              event.status === 'CANCELLED' ||
              booking.refundStatus === 'PROCESSED'
            );

            const isHoldExpired = !isConfirmed && (isExpired || booking.bookingStatus === 'EXPIRED' || (
              booking.cancellationReason && (
                booking.cancellationReason.toLowerCase().includes('hold expired') ||
                booking.cancellationReason.toLowerCase().includes('checkout window') ||
                booking.cancellationReason.toLowerCase().includes('elapsed')
              )
            ));

            const formattedEventDate = event.date
              ? new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Date TBD';

            const formattedBookedAt = booking.createdAt
              ? new Date(booking.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'N/A';

            const formattedBookedTime = booking.bookingTime || (booking.createdAt
              ? new Date(booking.createdAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })
              : '');

            const totalAmount = booking.totalAmount || ((event.ticketPrice || 0) * booking.ticketCount);
            const ticketRef = `#BKG-${booking._id.slice(-6).toUpperCase()}`;

            return (
              <div
                key={booking._id}
                className={`rounded-3xl border shadow-2xl overflow-hidden glass-card transition-all ${
                  isPending 
                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-slate-900/80 to-slate-900/90' 
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12">
                  
                  {/* Left Side: Ticket Details */}
                  <div className="md:col-span-8 p-6 md:p-8 space-y-6">
                    
                    {/* Status Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {booking.tierName && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30">
                            {booking.tierName}
                          </span>
                        )}
                        {isConfirmed && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            Booking Confirmed
                          </span>
                        )}
                        {booking.checkedIn && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                            Gate Admitted
                          </span>
                        )}
                        {isPending && (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                              Payment Pending
                            </span>
                            <ExpiryCountdown expiresAt={booking.expiresAt} onExpire={fetchBookings} />
                          </div>
                        )}
                        {isHoldExpired ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-400/25 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Hold Expired • Cancelled
                          </span>
                        ) : isEventCancelled ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-400/25 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Event Cancelled • 100% Refunded
                          </span>
                        ) : isCancelled ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-400/25 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Booking Cancelled
                          </span>
                        ) : null}
                      </div>

                      <span className="text-xs font-mono font-bold text-slate-500">
                        {ticketRef}
                      </span>
                    </div>

                    {/* Cancellation & Expiry Notice Banner */}
                    {isCancelled && (
                      <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                        isHoldExpired 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                      }`}>
                        <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isHoldExpired ? 'text-amber-400' : 'text-rose-400'}`} />
                        <div className="space-y-0.5">
                          <p className={`font-semibold ${isHoldExpired ? 'text-amber-300' : 'text-rose-300'}`}>
                            {isHoldExpired 
                              ? 'Hold Expired — Reservation Cancelled' 
                              : isEventCancelled 
                                ? 'Event Cancelled by Host / Organizer — 100% Refund Initiated' 
                                : 'Reservation Cancelled'}
                          </p>
                          <p className="text-[11px] text-slate-300">
                            {isHoldExpired
                              ? (booking.cancellationReason || 'Payment hold time (10 minutes) elapsed without completed payment. Reserved seats were automatically released back to the event.')
                              : isEventCancelled
                                ? `The event organizer has cancelled this listing. A full 100% refund of ₹${totalAmount.toLocaleString('en-IN')} has been initiated to your original payment method. Your entry pass is marked void.`
                                : (booking.cancellationReason || 'This booking has been cancelled and seat allocations have been released.')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pending Urgent Notice Banner */}
                    {isPending && (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Hourglass className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            Seats temporarily held for 10 minutes. Complete payment to secure your booking.
                          </span>
                        </div>
                        <Button
                          variant="gradient"
                          size="sm"
                          onClick={() => setPayingBooking(booking)}
                          className="shrink-0"
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1" />
                          <span>Pay Now</span>
                        </Button>
                      </div>
                    )}

                    {/* Event Title & Location */}
                    <div>
                      <h3 className="text-xl md:text-2xl font-black text-white hover:text-indigo-300 transition-colors">
                        <Link to={`/events/${event._id}`}>{event.eventName || 'Event Details'}</Link>
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                        <span className="flex items-center gap-1 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                          {event.venue || 'Venue TBD'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                          {formattedEventDate}
                        </span>
                        {event.time && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-300">
                              <Clock className="w-3.5 h-3.5 text-indigo-400" />
                              {event.time}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Passenger & Ticket Breakdown Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Primary Attendee</span>
                        <span className="font-bold text-white mt-0.5 block truncate">
                          {user?.name || 'Customer'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Pass Quantity</span>
                        <span className="font-bold text-white mt-0.5 block">
                          {booking.ticketCount} {booking.ticketCount === 1 ? 'Ticket' : 'Tickets'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Amount Payable</span>
                        <span className={`font-extrabold mt-0.5 block ${isPending ? 'text-amber-400' : 'text-indigo-400'}`}>
                          ₹{totalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          Booking Time
                        </span>
                        <span className="font-bold text-white mt-0.5 block font-mono">
                          {formattedBookedTime || 'N/A'}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          {formattedBookedAt}
                        </span>
                      </div>
                    </div>

                    {/* Ticket Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {isConfirmed && (
                        <>
                          <button
                            onClick={() =>
                              downloadTicketPdf({
                                booking,
                                event,
                                user,
                                qrCodeDataUrl: booking.qrCode || clientQrMap[booking._id],
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition cursor-pointer shadow-sm"
                            title="Download official PDF ticket pass with QR code"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Download Ticket (PDF)</span>
                          </button>
                          <button
                            onClick={() => setReceiptBooking(booking)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Tax Invoice / Receipt</span>
                          </button>
                        </>
                      )}

                      {isPending && (
                        <Button
                          variant="gradient"
                          size="sm"
                          onClick={() => setPayingBooking(booking)}
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                          <span>Complete Payment (₹{totalAmount})</span>
                        </Button>
                      )}
                    </div>

                  </div>

                  {/* Right Side: QR Gate Pass Stub */}
                  <div className={`md:col-span-4 p-6 md:p-8 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col items-center justify-center text-center space-y-4 ${
                    isPending ? 'bg-amber-950/20' : 'bg-slate-950/70'
                  }`}>
                    
                    {isConfirmed ? (
                      <>
                        {(() => {
                          const qrSrc = booking.qrCode || clientQrMap[booking._id];
                          return (
                            <div 
                              onClick={() => setEnlargedQrBooking(booking)}
                              className="p-3 bg-white rounded-2xl shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer group relative"
                              title="Click to view full-size gate admission pass"
                            >
                              {qrSrc ? (
                                <img
                                  src={qrSrc}
                                  alt={`Pass QR Code ${ticketRef}`}
                                  className="w-28 h-28 object-contain rounded-lg"
                                />
                              ) : (
                                <div className="w-28 h-28 bg-slate-950 rounded-xl p-2 flex flex-col justify-between">
                                  <div className="flex justify-between">
                                    <div className="w-6 h-6 bg-white rounded"></div>
                                    <div className="w-6 h-6 bg-white rounded"></div>
                                  </div>
                                  <div className="flex justify-center items-center">
                                    <QrCode className="w-7 h-7 text-indigo-400" />
                                  </div>
                                  <div className="flex justify-between">
                                    <div className="w-6 h-6 bg-white rounded"></div>
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                  </div>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-indigo-950/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[11px] font-bold text-white bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-700 flex items-center gap-1">
                                  <Maximize2 className="w-3 h-3" />
                                  Enlarge
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="space-y-0.5">
                          <span className="text-xs font-mono font-bold text-slate-200 block">
                            {ticketRef}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                            FAST-TRACK GATE ENTRY
                          </span>
                          <p className="text-[10px] text-slate-500">
                            Scan directly from your mobile device
                          </p>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verified Genuine Pass</span>
                        </div>
                      </>
                    ) : isPending ? (
                      <>
                        <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center text-amber-400 space-y-1">
                          <Lock className="w-8 h-8 text-amber-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">LOCKED</span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs font-mono font-bold text-amber-300 block">
                            PAYMENT REQUIRED
                          </span>
                          <p className="text-[10px] text-slate-400 max-w-[170px]">
                            Entry QR gate code will unlock as soon as payment is confirmed
                          </p>
                        </div>
                      </>
                    ) : isHoldExpired ? (
                      <>
                        <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center text-amber-400 space-y-1">
                          <Hourglass className="w-8 h-8 text-amber-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-amber-300">EXPIRED</span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs font-mono font-bold text-amber-300 block">
                            HOLD TIMEOUT
                          </span>
                          <p className="text-[10px] text-slate-400 max-w-[170px]">
                            10-minute payment hold elapsed; seats released back to event
                          </p>
                        </div>
                      </>
                    ) : isEventCancelled ? (
                      <>
                        <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center text-emerald-400 space-y-1">
                          <RotateCcw className="w-8 h-8 text-emerald-400 animate-pulse" />
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-300">REFUNDED</span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs font-mono font-bold text-emerald-300 block">
                            100% REFUNDED
                          </span>
                          <p className="text-[10px] text-emerald-400/90 font-medium max-w-[170px]">
                            ₹{totalAmount.toLocaleString('en-IN')} credited to original payment source
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex flex-col items-center justify-center text-rose-400 space-y-1">
                          <XCircle className="w-8 h-8 text-rose-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">VOID</span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs font-mono font-bold text-rose-300 block">
                            PASS CANCELLED
                          </span>
                          <p className="text-[10px] text-slate-400 max-w-[170px]">
                            Seats have been released back to other attendees
                          </p>
                        </div>
                      </>
                    )}

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Payment Gateway Modal */}
      {payingBooking && (
        <PaymentModal
          isOpen={!!payingBooking}
          onClose={() => setPayingBooking(null)}
          booking={payingBooking}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={() => {}}
        />
      )}

      {/* Official Tax Invoice & Pass Receipt Modal */}
      {receiptBooking && (
        <ReceiptModal
          isOpen={!!receiptBooking}
          onClose={() => setReceiptBooking(null)}
          booking={receiptBooking}
        />
      )}

      {/* Enlarged QR Code Gate Pass Modal */}
      {enlargedQrBooking && (
        <div 
          onClick={() => setEnlargedQrBooking(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 text-center space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Digital Entry Pass
              </span>
              <button 
                onClick={() => setEnlargedQrBooking(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <h4 className="text-base font-extrabold text-white">
                {enlargedQrBooking.event?.eventName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Pass Tier: <span className="text-indigo-300 font-semibold">{enlargedQrBooking.tierName || 'General Admission'}</span>
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-2xl max-w-[240px] mx-auto">
              <img
                src={enlargedQrBooking.qrCode || clientQrMap[enlargedQrBooking._id]}
                alt="Gate Admission QR Code"
                className="w-52 h-52 mx-auto object-contain"
              />
              <span className="block mt-2 text-xs font-mono font-bold text-slate-800 tracking-wider">
                #BKG-{(enlargedQrBooking._id || '').slice(-6).toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Present this QR code to the event gate scanner for express admission.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="gradient"
                size="sm"
                onClick={() =>
                  downloadTicketPdf({
                    booking: enlargedQrBooking,
                    event: enlargedQrBooking.event,
                    user,
                    qrCodeDataUrl: enlargedQrBooking.qrCode || clientQrMap[enlargedQrBooking._id],
                  })
                }
                className="w-full cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ticket PDF</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadQrImage({
                    booking: enlargedQrBooking,
                    event: enlargedQrBooking.event,
                    qrCodeDataUrl: enlargedQrBooking.qrCode || clientQrMap[enlargedQrBooking._id],
                  })
                }
                className="w-full cursor-pointer flex items-center justify-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Save QR</span>
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setEnlargedQrBooking(null)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

