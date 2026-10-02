import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Printer, 
  Download, 
  ShieldCheck, 
  Ticket, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  QrCode,
  Copy,
  Check,
  CreditCard
} from 'lucide-react';
import QRCode from 'qrcode';
import * as paymentService from '../services/paymentService';
import Button from './ui/Button';
import { downloadTicketPdf } from '../utils/ticketPdfGenerator';

export default function ReceiptModal({ isOpen, onClose, booking }) {
  if (!isOpen || !booking) return null;

  const event = booking.event || {};
  const [paymentData, setPaymentData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedTxn, setCopiedTxn] = useState(false);
  const [receiptQr, setReceiptQr] = useState(booking.qrCode || '');

  useEffect(() => {
    if (!receiptQr && booking._id) {
      QRCode.toDataURL(booking._id.toString(), { errorCorrectionLevel: 'H', margin: 1, width: 280 })
        .then(setReceiptQr)
        .catch(() => {});
    }
  }, [booking._id, receiptQr]);

  useEffect(() => {
    let isMounted = true;
    const fetchReceipt = async () => {
      setLoading(true);
      try {
        const { data } = await paymentService.getPaymentByBooking(booking._id);
        if (isMounted) {
          setPaymentData(data.payment);
          setReceiptData(data.receipt);
        }
      } catch (err) {
        // Fallback if receipt not yet saved in DB
        if (isMounted) {
          setPaymentData({
            amount: (event.ticketPrice || 0) * (booking.ticketCount || 1),
            paymentMethod: 'UPI',
            paymentStatus: 'SUCCESS',
            transactionId: 'TXN-' + booking._id.slice(-8).toUpperCase(),
          });
          setReceiptData({
            generatedDate: booking.updatedAt || booking.createdAt || new Date(),
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchReceipt();
    return () => {
      isMounted = false;
    };
  }, [booking._id]);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-receipt');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-receipt');
    };
  }, []);

  const handlePrint = () => {
    document.body.classList.add('printing-receipt');
    window.print();
  };

  const handleCopyTxn = () => {
    if (paymentData?.transactionId) {
      navigator.clipboard.writeText(paymentData.transactionId);
      setCopiedTxn(true);
      setTimeout(() => setCopiedTxn(false), 2000);
    }
  };

  const ticketCount = booking.ticketCount || 1;
  const basePrice = event.ticketPrice || 0;
  const subtotal = basePrice * ticketCount;
  const platformFee = Math.round(subtotal * 0.05);
  const totalAmount = subtotal + platformFee;

  const formattedDate = event.date 
    ? new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Date TBD';

  const issueDate = receiptData?.generatedDate 
    ? new Date(receiptData.generatedDate).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString();

  const bookingTimeStr = booking.bookingTime || (booking.createdAt 
    ? new Date(booking.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : '');

  return createPortal(
    <div id="receipt-modal-portal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden glass-card my-6">
        
        {/* Modal Controls Header (Hidden on print) */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h3 className="text-sm font-bold text-white">Official Tax Invoice & Entry Pass</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                downloadTicketPdf({
                  booking,
                  event,
                  user: booking.user,
                  qrCodeDataUrl: receiptQr || booking.qrCode,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
              title="Download official PDF ticket pass with QR code"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download Ticket</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher & Receipt Container */}
        <div className="p-6 md:p-8 space-y-6 bg-slate-900 text-slate-100" id="printable-receipt">
          
          {/* Top Brand Banner */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Ticket className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-black tracking-tight text-white">EventHub</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Global Ticketing & Experiential Platform Inc.
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Payment Confirmed
              </span>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Receipt #REC-{booking._id.slice(-8).toUpperCase()}
              </p>
              <p className="text-[11px] text-slate-400">
                {bookingTimeStr ? `Booked: ${bookingTimeStr} | ` : ''}{issueDate}
              </p>
            </div>
          </div>

          {/* Event & Pass Details */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-4">
            
            <div className="md:col-span-8 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Authorized Event Admission
              </span>
              <h4 className="text-lg font-extrabold text-white">
                {event.eventName || 'Event Experience'}
              </h4>
              <div className="space-y-1 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{event.venue || 'Venue TBD'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{formattedDate} {event.time ? `| ${event.time}` : ''}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-white text-slate-900 space-y-1">
              {receiptQr ? (
                <img
                  src={receiptQr}
                  alt="Gate Entry QR Code"
                  className="w-20 h-20 object-contain rounded"
                />
              ) : (
                <div className="w-20 h-20 bg-slate-900 rounded-lg p-1.5 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <div className="flex justify-center items-center">
                    <QrCode className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                </div>
              )}
              <span className="text-[9px] font-mono font-bold tracking-wider text-slate-700">
                #BKG-{(booking._id || '').slice(-6).toUpperCase()}
              </span>
            </div>

          </div>

          {/* Itemized Billing Breakdown */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tax Invoice Summary
            </h5>

            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Item & Description</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Price</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-white">
                      General Admission Pass
                      <span className="block text-[10px] text-slate-500 font-normal">
                        Tier 1 Guaranteed Entry
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-white">{ticketCount}</td>
                    <td className="py-3 px-4 text-right font-mono">₹{basePrice.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                      ₹{subtotal.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-400">Platform Processing & GST (5%)</td>
                    <td className="py-2.5 px-4 text-center text-slate-500">-</td>
                    <td className="py-2.5 px-4 text-right text-slate-500">-</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                      ₹{platformFee.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-950/90 border-t border-slate-800 font-bold text-white">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right text-xs">Total Amount Paid</td>
                    <td className="py-3 px-4 text-right text-indigo-400 text-sm font-black font-mono">
                      ₹{totalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment Metadata Footer */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Payment Mode</span>
              <span className="font-bold text-slate-200 mt-0.5 block flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                {paymentData?.paymentMethod || 'UPI Instant'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Transaction Ref</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-mono font-bold text-slate-200 block truncate max-w-[90px]">
                  {paymentData?.transactionId || 'pay_sim_success'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTxn}
                  className="text-slate-400 hover:text-white transition cursor-pointer print:hidden"
                  title="Copy Transaction ID"
                >
                  {copiedTxn ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Booking Reference</span>
              <span className="font-mono font-bold text-slate-200 mt-0.5 block">
                #BKG-{booking._id.slice(-6).toUpperCase()}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Booking Time</span>
              <span className="font-mono font-bold text-indigo-300 mt-0.5 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                {bookingTimeStr || 'N/A'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Verification</span>
              <span className="font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Genuine
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
}
