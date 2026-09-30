import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Download, 
  Search, 
  Users, 
  CheckCircle2, 
  Hourglass, 
  XCircle, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  DollarSign, 
  Ticket,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import * as bookingService from '../services/bookingService';
import Button from './ui/Button';

export default function AttendeesModal({ isOpen, onClose, event }) {
  if (!isOpen || !event) return null;

  const [attendees, setAttendees] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [checkingInId, setCheckingInId] = useState(null);

  const fetchAttendees = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await bookingService.getEventAttendees(event._id);
      setAttendees(data.attendees || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendees list for this event.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async (bookingId) => {
    setCheckingInId(bookingId);
    try {
      await bookingService.checkInAttendee({ bookingId, eventId: event._id });
      fetchAttendees();
    } catch (err) {
      alert(err.response?.data?.message || 'Check-in failed');
    } finally {
      setCheckingInId(null);
    }
  };

  useEffect(() => {
    fetchAttendees();
  }, [event._id]);

  // Client-side search and status filtering
  const filteredAttendees = useMemo(() => {
    return attendees.filter((item) => {
      const user = item.user || {};
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const mobile = (user.mobile || '').toLowerCase();
      const bookingId = (item._id || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || mobile.includes(q) || bookingId.includes(q);
      const matchesStatus = statusFilter === 'ALL' || item.bookingStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [attendees, searchQuery, statusFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!attendees.length) return;

    const headers = [
      'Booking Reference',
      'Attendee Name',
      'Email Address',
      'Mobile Number',
      'Pass Tier',
      'Pass Quantity',
      'Booking Status',
      'Gate Check-in',
      'Check-in Time',
      'Unit Price (INR)',
      'Total Amount (INR)',
      'Booking Time',
      'Booking Timestamp'
    ];

    const rows = filteredAttendees.map((b) => {
      const u = b.user || {};
      const unitPrice = b.unitPrice || event.ticketPrice || 0;
      const total = b.totalAmount || (unitPrice * (b.ticketCount || 1));
      const bookedTime = b.bookingTime || (b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
      const bookedAt = b.createdAt ? new Date(b.createdAt).toISOString() : '';
      const checkedInTime = b.checkedInAt ? new Date(b.checkedInAt).toLocaleString('en-US') : '';

      return [
        `#BKG-${b._id.slice(-6).toUpperCase()}`,
        `"${(u.name || 'Anonymous').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.mobile || '').replace(/"/g, '""')}"`,
        `"${b.tierName || 'General Admission'}"`,
        b.ticketCount || 1,
        b.bookingStatus,
        b.checkedIn ? 'CHECKED_IN' : 'PENDING',
        `"${checkedInTime}"`,
        unitPrice,
        total,
        `"${bookedTime}"`,
        `"${bookedAt}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanEventName = (event.eventName || 'Event').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `${cleanEventName}_Attendees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const confirmedCount = attendees.filter((b) => b.bookingStatus === 'CONFIRMED').length;
  const pendingCount = attendees.filter((b) => b.bookingStatus === 'PENDING').length;
  const cancelledCount = attendees.filter((b) => b.bookingStatus === 'CANCELLED').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden glass-card my-6">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between p-5 md:p-6 border-b border-slate-800 bg-slate-950/70 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
                Attendee Roster & Manifest
              </span>
            </div>
            <h3 className="text-xl font-black text-white">{event.eventName}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{event.venue || 'Venue TBD'}</span>
              <span>•</span>
              <span>₹{event.ticketPrice?.toLocaleString('en-IN')} per seat</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="gradient"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredAttendees.length === 0}
              className="cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              <span>Export CSV ({filteredAttendees.length})</span>
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 space-y-6">
          
          {/* Quick KPI Stats Row */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-500 font-medium block">Total Bookings</span>
                <span className="text-xl font-black text-white mt-0.5 block">{stats.totalBookings}</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[11px] text-emerald-400 font-medium block">Confirmed Attendees</span>
                <span className="text-xl font-black text-emerald-300 mt-0.5 block">{stats.confirmedBookings}</span>
              </div>
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-[11px] text-indigo-400 font-medium block">Seats Sold</span>
                <span className="text-xl font-black text-indigo-300 mt-0.5 block">{stats.totalConfirmedSeats}</span>
              </div>
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-[11px] text-purple-400 font-medium block">Event Revenue</span>
                <span className="text-xl font-black text-purple-300 mt-0.5 block">
                  ₹{stats.totalRevenue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/50 border border-slate-800 text-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, phone or booking ID..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                All ({attendees.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CONFIRMED')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'CONFIRMED'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Confirmed ({confirmedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CANCELLED')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'CANCELLED'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Cancelled ({cancelledCount})
              </button>
            </div>
          </div>

          {/* Attendees Table */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/60 max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 border-b border-slate-800 z-10">
                <tr>
                  <th className="py-3 px-4">Attendee</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-center">Tickets</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Gate Check-in</th>
                  <th className="py-3 px-4 text-right">Booking Time & Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                
                {loading && (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      Loading attendee manifest...
                    </td>
                  </tr>
                )}

                {error && (
                  <tr>
                    <td colSpan="7" className="py-8 px-4 text-center text-rose-400">
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredAttendees.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500 space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto" />
                      <p>No attendees found matching your criteria.</p>
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredAttendees.map((b) => {
                  const u = b.user || {};
                  const isConfirmed = b.bookingStatus === 'CONFIRMED';
                  const isPending = b.bookingStatus === 'PENDING';
                  const total = b.totalAmount || ((b.unitPrice || event.ticketPrice || 0) * (b.ticketCount || 1));
                  const bookedDate = b.createdAt
                    ? new Date(b.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'N/A';
                  const bookedTime = b.bookingTime || (b.createdAt
                    ? new Date(b.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })
                    : '');

                  return (
                    <tr key={b._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30 shrink-0">
                            {(u.name || 'A')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="block truncate max-w-[140px]">{u.name || 'Anonymous Attendee'}</span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              #BKG-{b._id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="block text-slate-300 text-[11px] truncate max-w-[160px]">{u.email || '—'}</span>
                          <span className="block text-slate-500 text-[10px]">{u.mobile || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-white">
                        <div>{b.ticketCount || 1}</div>
                        {b.tierName && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {b.tierName}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-400">
                        ₹{total.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        {isConfirmed && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            CONFIRMED
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            PENDING
                          </span>
                        )}
                        {!isConfirmed && !isPending && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/20 flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            {b.bookingStatus}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {b.checkedIn ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Admitted
                            </span>
                            {b.checkedInAt && (
                              <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
                                {new Date(b.checkedInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                          </div>
                        ) : isConfirmed ? (
                          <button
                            type="button"
                            disabled={checkingInId === b._id}
                            onClick={() => handleManualCheckIn(b._id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                          >
                            {checkingInId === b._id ? 'Admitting...' : 'Check In'}
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-indigo-400 text-xs block">
                          {bookedTime || 'N/A'}
                        </span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          {bookedDate}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}
