import { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  CreditCard, 
  Smartphone, 
  Building2, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Lock, 
  ArrowRight,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import * as paymentService from '../services/paymentService';
import { useAuth } from '../context/AuthContext';
import { launchRazorpayCheckout } from '../utils/razorpay';
import Button from './ui/Button';

export default function PaymentModal({ isOpen, onClose, booking, onPaymentSuccess, onPaymentFailure }) {
  if (!isOpen || !booking) return null;

  const { user } = useAuth();

  // Tabs: 'UPI' | 'CARD' | 'NETBANKING'
  const [selectedMethod, setSelectedMethod] = useState('UPI');
  const [showSimulator, setShowSimulator] = useState(false);

  // Order state from backend
  const [orderData, setOrderData] = useState(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState('');

  // Processing & Simulation state
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [simulateFailure, setSimulateFailure] = useState(false);

  // Form Inputs
  const [upiId, setUpiId] = useState('customer@okhdfcbank');
  const [cardNumber, setCardNumber] = useState('4532 8920 1192 8841');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('482');
  const [cardName, setCardName] = useState('Alex Mercer');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Pricing calculations
  const event = booking.event || {};
  const ticketCount = booking.ticketCount || 1;
  const basePrice = booking.unitPrice || event.ticketPrice || 0;
  const rawSubtotal = booking.subtotal !== undefined ? booking.subtotal : (basePrice * ticketCount);
  const rawFee = booking.platformFee !== undefined ? booking.platformFee : Math.round(rawSubtotal * 0.05);
  const rawTotal = booking.totalAmount !== undefined ? booking.totalAmount : (rawSubtotal + rawFee);

  // Authoritative amount synchronized directly with Razorpay orderData from backend
  const subtotal = orderData?.subtotal !== undefined ? orderData.subtotal : rawSubtotal;
  const platformFee = orderData?.platformFee !== undefined ? orderData.platformFee : rawFee;
  const totalAmount = orderData?.amount !== undefined ? orderData.amount : rawTotal;

  // Initialize payment order from backend
  useEffect(() => {
    let isMounted = true;
    const initOrder = async () => {
      setOrderLoading(true);
      setOrderError('');
      try {
        const { data } = await paymentService.createOrder(booking._id);
        if (isMounted) {
          setOrderData(data);
        }
      } catch (err) {
        if (isMounted) {
          setOrderError(err.response?.data?.message || 'Failed to initialize payment gateway.');
        }
      } finally {
        if (isMounted) {
          setOrderLoading(false);
        }
      }
    };

    initOrder();
    return () => {
      isMounted = false;
    };
  }, [booking._id]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText('eventhub.tickets@icici');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleRazorpayCheckout = async () => {
    if (!orderData) return;
    setProcessing(true);
    setPaymentError('');
    setProcessingStep('Launching Razorpay Checkout window...');

    try {
      await launchRazorpayCheckout({
        orderData,
        user,
        eventName: event.eventName || 'Event Passes',
        onSuccess: async (response) => {
          setProcessingStep('Verifying payment signature with security gateway...');
          try {
            const { data } = await paymentService.verifyPayment({
              paymentId: orderData.paymentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentMethod: 'RAZORPAY_POPUP',
            });

            setPaymentSuccess(data);
            if (onPaymentSuccess) {
              onPaymentSuccess(data);
            }
          } catch (err) {
            setPaymentError(err.response?.data?.message || 'Payment signature verification failed.');
          } finally {
            setProcessing(false);
          }
        },
        onFailure: (err) => {
          setPaymentError(err.message || 'Payment authorization was cancelled or declined.');
          setProcessing(false);
        },
        onDismiss: () => {
          setProcessing(false);
          setProcessingStep('');
        },
      });
    } catch (err) {
      setPaymentError(err.message || 'Could not initialize Razorpay checkout.');
      setProcessing(false);
    }
  };

  const handleSimulatedPayment = async () => {
    if (!orderData) return;
    setProcessing(true);
    setPaymentError('');

    try {
      // Step 1: Gateway simulation delay
      setProcessingStep('Connecting to secure banking network...');
      await new Promise((r) => setTimeout(r, 700));

      if (simulateFailure) {
        setProcessingStep('Simulating transaction decline...');
        await new Promise((r) => setTimeout(r, 600));

        // Submit deliberately invalid signature to test backend failure handling
        await paymentService.verifyPayment({
          paymentId: orderData.paymentId,
          razorpayOrderId: orderData.razorpayOrderId,
          razorpayPaymentId: 'pay_fail_' + Date.now(),
          razorpaySignature: 'invalid_signature_simulation',
          paymentMethod: selectedMethod,
        });
        return;
      }

      setProcessingStep('Authorizing payment with issuer...');
      await new Promise((r) => setTimeout(r, 700));

      setProcessingStep('Finalizing ticket reservation...');
      const razorpayPaymentId = `pay_${selectedMethod.toLowerCase()}_${Date.now()}`;
      
      // Send genuine verification payload to backend
      const { data } = await paymentService.verifyPayment({
        paymentId: orderData.paymentId,
        razorpayOrderId: orderData.razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: 'simulated_valid_signature',
        paymentMethod: selectedMethod,
      });

      setPaymentSuccess(data);
      if (onPaymentSuccess) {
        onPaymentSuccess(data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Payment transaction failed or was declined.';
      setPaymentError(msg);
      if (onPaymentFailure) {
        onPaymentFailure(err);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden glass-card my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">EventHub Secure Gateway</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Razorpay Sandbox
                </span>
              </div>
              <p className="text-xs text-slate-400">
                256-Bit SSL Encrypted Checkout
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={processing}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 md:p-6 space-y-6">
          
          {/* Order Summary Strip */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Paying for Event</span>
              <span className="text-sm font-bold text-white block truncate max-w-xs">
                {event.eventName || 'Event Passes'}
              </span>
              <span className="text-xs text-indigo-300">
                {ticketCount} {ticketCount === 1 ? 'Pass' : 'Passes'}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block font-medium">Amount Due</span>
              <span className="text-xl font-black text-indigo-400">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Loading or Error State for Order Creation */}
          {orderLoading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Generating secure transaction session...</p>
            </div>
          )}

          {orderError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{orderError}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {/* Payment Success View */}
          {paymentSuccess && (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl animate-bounce">
                ✓
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-black text-white">Payment Successful!</h4>
                <p className="text-xs text-slate-400">
                  Transaction verified by gateway. Your admission pass is confirmed.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-left space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID</span>
                  <span className="font-mono font-bold text-white">
                    {paymentSuccess.payment?.transactionId || 'pay_sim_success'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method</span>
                  <span className="font-semibold text-indigo-300">{selectedMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-black text-emerald-400">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Time</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {booking.bookingTime || (booking.createdAt ? new Date(booking.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="font-bold text-emerald-400">CONFIRMED</span>
                </div>
              </div>

              <div className="pt-2">
                <Button variant="gradient" size="md" onClick={onClose} className="w-full max-w-sm mx-auto">
                  <span>View Pass in My Bookings</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Active Payment Flow Form */}
          {!orderLoading && !orderError && !paymentSuccess && (
            <div className="space-y-6">
              
              {/* Primary Official Razorpay Checkout Card */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-purple-950/50 border border-indigo-500/40 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black text-xl shadow-inner">
                      ₹
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">Razorpay Checkout</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 uppercase tracking-wider">
                          Official Popup
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        UPI Apps, QR Code, Cards, Net Banking & Wallets
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="gradient"
                  size="lg"
                  loading={processing}
                  onClick={handleRazorpayCheckout}
                  className="w-full py-4 text-sm font-bold shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-[0.99]"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {processing ? (processingStep || 'Processing...') : `Open Razorpay Popup (₹${totalAmount.toLocaleString('en-IN')})`}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Official 256-Bit SSL Pop-up
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Order: {orderData?.razorpayOrderId ? `${orderData.razorpayOrderId.slice(0, 10)}...` : 'ready'}
                  </span>
                </div>
              </div>

              {/* Error Alert */}
              {paymentError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Collapsible QA Simulation Accordion Header */}
              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowSimulator(!showSimulator)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Developer QA & Offline Sandbox Simulator</span>
                  </span>
                  {showSimulator ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* QA Simulator Content */}
              {showSimulator && (
                <div className="space-y-6 pt-2 p-4 rounded-3xl bg-slate-950/40 border border-slate-800/50">
                  {/* Payment Methods Tabs */}
                  <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('UPI')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedMethod === 'UPI'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>UPI / QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('CARD')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedMethod === 'CARD'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('NETBANKING')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedMethod === 'NETBANKING'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Net Banking</span>
                    </button>
                  </div>

              {/* METHOD 1: UPI */}
              {selectedMethod === 'UPI' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                    
                    {/* Simulated Dynamic UPI QR */}
                    <div className="flex flex-col items-center justify-center text-center p-4 rounded-xl bg-white space-y-2">
                      <div className="w-32 h-32 bg-slate-900 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="w-7 h-7 bg-white rounded"></div>
                          <div className="w-7 h-7 bg-white rounded"></div>
                        </div>
                        <div className="flex justify-center items-center">
                          <QrCode className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div className="flex justify-between">
                          <div className="w-7 h-7 bg-white rounded"></div>
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 tracking-wider">
                        SCAN WITH ANY UPI APP
                      </span>
                    </div>

                    {/* VPA Apps Info */}
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Supported UPI Apps</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'CRED'].map((app) => (
                            <span
                              key={app}
                              className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 text-[10px] font-semibold border border-slate-800"
                            >
                              {app}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Merchant UPI ID</span>
                        <div className="flex items-center justify-between gap-2 mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-indigo-300">
                          <span>eventhub.tickets@icici</span>
                          <button
                            type="button"
                            onClick={handleCopyUpi}
                            className="text-slate-400 hover:text-white transition cursor-pointer"
                            title="Copy UPI ID"
                          >
                            {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Manual UPI ID Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Or enter your personal UPI VPA</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@okhdfcbank"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* METHOD 2: CARDS */}
              {selectedMethod === 'CARD' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Name on card"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532 0000 0000 0000"
                        maxLength={19}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="absolute right-3 top-2 text-[11px] font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        VISA / RuPay
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">CVV / CVC</label>
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="•••"
                        maxLength={4}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* METHOD 3: NET BANKING */}
              {selectedMethod === 'NETBANKING' && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-300">Select Banking Partner</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { name: 'HDFC Bank', code: 'HDFC' },
                      { name: 'ICICI Bank', code: 'ICICI' },
                      { name: 'State Bank of India', code: 'SBI' },
                      { name: 'Axis Bank', code: 'AXIS' },
                      { name: 'Kotak Bank', code: 'KOTAK' },
                      { name: 'Punjab National Bank', code: 'PNB' },
                    ].map((bank) => (
                      <button
                        type="button"
                        key={bank.code}
                        onClick={() => setSelectedBank(bank.name)}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          selectedBank === bank.name
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] font-mono font-bold text-indigo-400 block">{bank.code}</span>
                        <span className="text-xs font-semibold mt-0.5 block truncate">{bank.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

                  {/* Developer Test Mode Switch */}
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>QA Test: Simulate Payment Failure</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simulateFailure}
                        onChange={(e) => setSimulateFailure(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <Button
                      variant={simulateFailure ? 'destructive' : 'gradient'}
                      size="lg"
                      loading={processing}
                      onClick={handleSimulatedPayment}
                      className="w-full py-3 text-sm font-bold shadow-xl cursor-pointer"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      <span>
                        {processing 
                          ? (processingStep || 'Processing...') 
                          : simulateFailure 
                          ? `Test Pay Decline (₹${totalAmount})` 
                          : `Simulate & Pay ₹${totalAmount.toLocaleString('en-IN')}`}
                      </span>
                    </Button>

                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Dev Sandbox Simulation Mode</span>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
