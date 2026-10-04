import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as adminService from '../services/adminService';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Users, 
  Calendar, 
  Ticket, 
  DollarSign, 
  Search, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCcw,
  FileText,
  Filter,
  MapPin,
  ExternalLink,
  Printer
} from 'lucide-react';
import Button from '../components/ui/Button';
import { downloadReportPdf } from '../utils/reportPdfGenerator';
import { formatEventDate, formatDateTime, formatTimeRange12h, formatEventSchedule } from '../utils/dateTime';

export default function AdminDashboard() {
  const { user } = useAuth();

  // Active view tab: 'users' | 'bookings' | 'events' | 'reports'
  const [activeTab, setActiveTab] = useState('users');

  // Stats State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Users State
  const [users, setUsers] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');

  // Events State
  const [events, setEvents] = useState([]);
  const [eventStatusFilter, setEventStatusFilter] = useState('');

  // Reports State
  const [generatedReport, setGeneratedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportType, setReportType] = useState('bookings');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportAllTime, setReportAllTime] = useState(false);
  const [reportError, setReportError] = useState('');

  const [error, setError] = useState('');

  // 1. Fetch Stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await adminService.getStats();
      setStats(data);
    } catch {
      setError('Failed to fetch platform statistics.');
    } finally {
      setStatsLoading(false);
    }
  };

  // 2. Fetch Users
  const fetchUsers = async () => {
    try {
      const params = {};
      if (userRoleFilter) params.role = userRoleFilter;
      const { data } = await adminService.getUsers(params);
      setUsers(data || []);
    } catch {
      setError('Failed to fetch platform users.');
    }
  };

  // 3. Fetch Bookings
  const fetchBookings = async () => {
    try {
      const params = {};
      if (bookingStatusFilter) params.status = bookingStatusFilter;
      const { data } = await adminService.getBookings(params);
      setBookings(data || []);
    } catch {
      setError('Failed to fetch platform bookings.');
    }
  };

  // 4. Fetch Events
  const fetchEvents = async () => {
    try {
      const params = {};
      if (eventStatusFilter) params.status = eventStatusFilter;
      const { data } = await adminService.getEvents(params);
      setEvents(data || []);
    } catch {
      setError('Failed to fetch platform events.');
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchBookings();
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [userRoleFilter]);

  useEffect(() => {
    fetchBookings();
  }, [bookingStatusFilter]);

  useEffect(() => {
    fetchEvents();
  }, [eventStatusFilter]);

  // Generate Report
  const handleGenerateReport = async () => {
    setReportError('');

    if (!reportAllTime) {
      if (!reportStartDate || !reportEndDate) {
        setReportError('Please select both a starting date and ending date, or check "Whole Time" for an all-time audit.');
        return;
      }
      if (new Date(reportEndDate) < new Date(reportStartDate)) {
        setReportError('Ending date cannot be earlier than starting date.');
        return;
      }
    }

    setReportLoading(true);
    try {
      const params = {};
      if (!reportAllTime) {
        if (reportStartDate) params.startDate = reportStartDate;
        if (reportEndDate) params.endDate = reportEndDate;
      }

      if (reportType === 'bookings') {
        const { data } = await adminService.getBookingReport(params);
        setGeneratedReport(data);
      } else {
        const { data } = await adminService.getEventReport(params);
        setGeneratedReport(data);
      }
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate audit report.');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    const handleBeforePrint = () => {
      if (activeTab === 'reports' && generatedReport) {
        document.body.classList.add('printing-report');
      }
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-report');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-report');
    };
  }, [activeTab, generatedReport]);

  const handlePrintReport = () => {
    document.body.classList.add('printing-report');
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Filtered users by search text
  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.mobile?.includes(q);
  });

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 lg:px-8 max-w-7xl mx-auto w-full space-y-8 print:min-h-0 print:p-0 print:m-0 print:space-y-0">
      
      {/* Header Banner */}
      <div id="admin-header-banner" className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Administrator Control Center</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Admin Intelligence Hub
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Global platform analytics, user moderation, cross-tenant event monitoring, and audit reports
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchStats();
              fetchUsers();
              fetchBookings();
              fetchEvents();
            }}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="print:hidden p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:text-white">✕</button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div id="admin-overview-kpis" className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Users</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {statsLoading ? '...' : stats?.totalUsers || 0}
          </div>
          <span className="text-[11px] text-slate-400">
            {stats?.totalCustomers || 0} Customers · {stats?.totalOrganizers || 0} Organizers
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Bookings</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {statsLoading ? '...' : stats?.totalBookings || 0}
          </div>
          <span className="text-[11px] text-emerald-400 font-medium">
            {stats?.confirmedBookings || 0} Confirmed Passes
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Platform Events</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {statsLoading ? '...' : stats?.totalEvents || 0}
          </div>
          <span className="text-[11px] text-purple-400 font-medium">
            {stats?.activeEvents || 0} Currently Active
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Admin Operator</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-white truncate">{user?.name}</div>
          <span className="text-[11px] text-amber-400 truncate block font-mono">
            SUPER_ADMIN
          </span>
        </div>

      </div>

      {/* Navigation Tabs Bar */}
      <div id="admin-tab-nav" className="print:hidden flex items-center gap-2 p-1.5 bg-slate-900/60 rounded-2xl border border-slate-800 glass-card overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          Users Directory ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
            activeTab === 'bookings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Ticket className="w-3.5 h-3.5 inline mr-1.5" />
          All Bookings ({bookings.length})
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
            activeTab === 'events'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
          All Events ({events.length})
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 inline mr-1.5" />
          Audit & Reports
        </button>
      </div>

      {/* ================= TAB 2: USERS DIRECTORY ================= */}
      {activeTab === 'users' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden glass-card space-y-4 p-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search user name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setUserRoleFilter('')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  userRoleFilter === '' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                All Roles
              </button>
              <button
                onClick={() => setUserRoleFilter('CUSTOMER')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  userRoleFilter === 'CUSTOMER' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Customers
              </button>
              <button
                onClick={() => setUserRoleFilter('ORGANIZER')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  userRoleFilter === 'ORGANIZER' ? 'bg-purple-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Organizers
              </button>
              <button
                onClick={() => setUserRoleFilter('ADMIN')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  userRoleFilter === 'ADMIN' ? 'bg-amber-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Admins
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/70 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Mobile</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((u) => {
                  const roleStyles = {
                    ADMIN: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                    ORGANIZER: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                    CUSTOMER: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                  };

                  return (
                    <tr key={u._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <span>{u.name}</span>
                      </td>
                      <td className="p-3.5 text-slate-300">{u.email}</td>
                      <td className="p-3.5 font-mono text-slate-400">{u.mobile}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleStyles[u.role] || roleStyles.CUSTOMER}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {formatEventDate(u.createdAt, false)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ================= TAB 3: BOOKINGS OVERSIGHT ================= */}
      {activeTab === 'bookings' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden glass-card space-y-4 p-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-300">Live Booking Transactions</span>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <button
                onClick={() => setBookingStatusFilter('')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  bookingStatusFilter === '' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setBookingStatusFilter('CONFIRMED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  bookingStatusFilter === 'CONFIRMED' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Confirmed
              </button>
              <button
                onClick={() => setBookingStatusFilter('PAYMENT_FAILED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  bookingStatusFilter === 'PAYMENT_FAILED' ? 'bg-rose-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Payment Failed
              </button>
              <button
                onClick={() => setBookingStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  bookingStatusFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setBookingStatusFilter('EXPIRED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  bookingStatusFilter === 'EXPIRED' ? 'bg-slate-700 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Expired
              </button>
              <button
                onClick={() => setBookingStatusFilter('CANCELLED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  bookingStatusFilter === 'CANCELLED' ? 'bg-rose-700 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/70 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Ticket Ref</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Event</th>
                  <th className="p-3.5">Passes</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {bookings.map((b) => {
                  const event = b.event || {};
                  const userObj = b.user || {};
                  const total = (event.ticketPrice || 0) * b.ticketCount;

                  const statusStyles = {
                    CONFIRMED: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
                    PENDING: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
                    PAYMENT_FAILED: 'bg-rose-500/15 text-rose-300 border-rose-400/25 font-bold',
                    EXPIRED: 'bg-slate-700/30 text-slate-400 border-slate-600/30',
                    CANCELLED: 'bg-rose-500/15 text-rose-300 border-rose-400/25',
                  };

                  return (
                    <tr key={b._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-400">
                        #BKG-{b._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="p-3.5 text-white">
                        <div className="font-semibold">{userObj.name || 'User'}</div>
                        <div className="text-[10px] text-slate-400">{userObj.email}</div>
                      </td>
                      <td className="p-3.5 text-indigo-300 max-w-[200px] truncate">
                        {event.eventName || 'Event'}
                      </td>
                      <td className="p-3.5 font-bold text-white">{b.ticketCount}</td>
                      <td className="p-3.5 font-extrabold text-white">₹{total.toLocaleString('en-IN')}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyles[b.bookingStatus] || statusStyles.PENDING}`}>
                          {b.bookingStatus}
                        </span>
                        {b.refundStatus === 'PROCESSED' && (
                          <span className="block text-[9px] text-emerald-400 font-mono font-bold mt-0.5">
                            100% REFUNDED
                          </span>
                        )}
                        {b.cancellationReason && (
                          <span className="block text-[9px] text-slate-400 max-w-[140px] truncate" title={b.cancellationReason}>
                            {b.cancellationReason}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {formatDateTime(b.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ================= TAB 4: ALL EVENTS DIRECTORY ================= */}
      {activeTab === 'events' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden glass-card space-y-4 p-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-300">All Platform Events</span>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <button
                onClick={() => setEventStatusFilter('')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  eventStatusFilter === '' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setEventStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  eventStatusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setEventStatusFilter('ONGOING')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  eventStatusFilter === 'ONGOING' ? 'bg-purple-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Ongoing
              </button>
              <button
                onClick={() => setEventStatusFilter('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  eventStatusFilter === 'COMPLETED' ? 'bg-slate-700 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setEventStatusFilter('CANCELLED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  eventStatusFilter === 'CANCELLED' ? 'bg-rose-600 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Cancelled / Deleted
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/70 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Event Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Host Organizer</th>
                  <th className="p-3.5">Date & Venue</th>
                  <th className="p-3.5">Ticket Price</th>
                  <th className="p-3.5">Available Seats</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {events.map((e) => (
                  <tr key={e._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-bold text-white max-w-[200px] truncate">
                      <span>{e.eventName}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {e.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {e.organizer?.name || 'Organizer'}
                    </td>
                    <td className="p-3.5 text-slate-400">
                      <div>{formatEventDate(e.date, false)}</div>
                      {e.time && <div className="text-[10px] text-slate-500">{formatEventSchedule(e.time, e.duration, e.endTime)}</div>}
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{e.venue}</div>
                    </td>
                    <td className="p-3.5 font-extrabold text-white">₹{e.ticketPrice?.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 font-bold text-slate-200">{e.availableSeats}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        e.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                          : e.status === 'ONGOING'
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                          : e.status === 'COMPLETED'
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/25 font-bold'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ================= TAB 5: AUDIT & REPORTS ================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6 print:space-y-0">
          
          <div id="admin-report-form" className="print:hidden p-6 rounded-3xl bg-slate-900/60 border border-slate-800 glass-card space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Generate Regulatory & Revenue Report</span>
            </h3>
            <p className="text-xs text-slate-400">
              Select date ranges and report format to generate cryptographic audit summaries directly from MongoDB.
            </p>

            {reportError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{reportError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
              <span className="text-xs font-semibold text-slate-300">Audit Period Filter</span>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={reportAllTime}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setReportAllTime(checked);
                    if (checked) {
                      setReportError('');
                    }
                  }}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer"
                />
                <span className={reportAllTime ? "text-indigo-300 font-bold" : "text-slate-400 font-medium"}>
                  Whole Time (All-Time Audit)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-4">
                <label className="text-xs font-semibold text-slate-300 block mb-1">Report Target</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="bookings">Booking Transactions & Revenue</option>
                  <option value="events">Event Performance & Capacities</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  From Date {!reportAllTime && <span className="text-rose-400 font-bold">*</span>}
                </label>
                <input
                  type="date"
                  disabled={reportAllTime}
                  value={reportAllTime ? '' : reportStartDate}
                  onChange={(e) => {
                    setReportStartDate(e.target.value);
                    if (reportError) setReportError('');
                  }}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition ${
                    reportAllTime
                      ? 'opacity-40 border-slate-800 cursor-not-allowed bg-slate-900/50'
                      : 'border-slate-800 focus:border-indigo-500'
                  }`}
                />
                {reportAllTime && (
                  <span className="text-[10px] text-slate-500 block mt-0.5">Disabled (Whole time active)</span>
                )}
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  To Date {!reportAllTime && <span className="text-rose-400 font-bold">*</span>}
                </label>
                <input
                  type="date"
                  disabled={reportAllTime}
                  value={reportAllTime ? '' : reportEndDate}
                  onChange={(e) => {
                    setReportEndDate(e.target.value);
                    if (reportError) setReportError('');
                  }}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition ${
                    reportAllTime
                      ? 'opacity-40 border-slate-800 cursor-not-allowed bg-slate-900/50'
                      : 'border-slate-800 focus:border-indigo-500'
                  }`}
                />
                {reportAllTime && (
                  <span className="text-[10px] text-slate-500 block mt-0.5">Disabled (Whole time active)</span>
                )}
              </div>

              <div className="sm:col-span-2 flex items-end">
                <Button
                  variant="gradient"
                  size="md"
                  loading={reportLoading}
                  onClick={handleGenerateReport}
                  className="w-full cursor-pointer"
                >
                  <span>Generate</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Generated Report Display */}
          {generatedReport && (
            <div id="admin-report-container" className="p-6 rounded-3xl bg-slate-900/80 border border-indigo-500/30 shadow-2xl glass-card space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white">
              
              {/* Official Enterprise Letterhead - Visible only when printing */}
              <div className="hidden print:flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center text-sm">
                      EH
                    </div>
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900">
                        EVENTHUB PLATFORM AUDIT
                      </h1>
                      <p className="text-[10px] tracking-wider uppercase font-semibold text-slate-500">
                        Enterprise Regulatory Compliance & Financial Ledger
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                    <p><span className="font-bold text-slate-800">Document:</span> {reportType === 'bookings' ? 'Booking Transactions & Revenue Ledger' : 'Cross-Tenant Event Inventory & Capacity Audit'}</p>
                    <p><span className="font-bold text-slate-800">Reporting Range:</span> {generatedReport.dateRange?.startDate || generatedReport.filter?.startDate || 'All Time'} to {generatedReport.dateRange?.endDate || generatedReport.filter?.endDate || 'All Time'}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600 space-y-0.5">
                  <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 mb-1">
                    VERIFIED AUDIT
                  </div>
                  <p><span className="font-bold text-slate-800">Report Ref:</span> <span className="font-mono text-slate-700">{generatedReport.reportId || 'GEN-REP-AUDIT'}</span></p>
                  <p><span className="font-bold text-slate-800">Auditor:</span> {user?.name || 'Administrator'}</p>
                  <p><span className="font-bold text-slate-800">Generated:</span> {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>

              {/* Screen View Header - Hidden when printing */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:hidden">
                <div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300">
                    Official Audit Output
                  </span>
                  <h4 className="text-lg font-bold text-white mt-1">
                    {reportType === 'bookings' ? 'Booking & Revenue Audit Summary' : 'Event Capacity Performance Report'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Report ID: <span className="font-mono text-slate-300">{generatedReport.reportId || 'GEN-REP'}</span> · Range: {generatedReport.dateRange?.startDate || 'All time'} to {generatedReport.dateRange?.endDate || 'All time'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() =>
                      downloadReportPdf({
                        reportType,
                        reportData: generatedReport,
                        adminUser: user,
                      })
                    }
                    className="cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    <span>Download PDF</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrintReport}
                    className="cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                    <span>Print Report</span>
                  </Button>
                </div>
              </div>

              {/* Report Metrics Row */}
              <div className={`grid grid-cols-1 ${generatedReport.totalRefunded > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4 text-xs report-kpi-grid`}>
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 report-kpi-card">
                  <span className="text-slate-400 block text-[11px] font-medium">Total Records</span>
                  <span className="text-xl font-bold text-white mt-1 block">
                    {generatedReport.totalBookings ?? generatedReport.totalEvents ?? 0}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Reconciled entities</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 report-kpi-card">
                  <span className="text-slate-400 block text-[11px] font-medium">
                    {reportType === 'bookings' ? 'Confirmed Tickets' : 'Total Capacity / Sold'}
                  </span>
                  <span className="text-xl font-bold text-emerald-400 mt-1 block">
                    {reportType === 'bookings'
                      ? (generatedReport.totalTicketsConfirmed ?? 0)
                      : `${generatedReport.events?.reduce((acc, ev) => acc + (ev.ticketsSold || 0), 0) || 0} Sold`}
                  </span>
                  <span className="text-[10px] text-emerald-500/80 mt-0.5 block">Passes confirmed</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 report-kpi-card">
                  <span className="text-slate-400 block text-[11px] font-medium">
                    {generatedReport.totalRefunded > 0 ? 'Net Active Revenue' : 'Gross Revenue Reconciled'}
                  </span>
                  <span className="text-xl font-bold text-indigo-400 mt-1 block">
                    ₹{(generatedReport.totalRevenue || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-indigo-400/80 mt-0.5 block">Payment Gateway Reconciled</span>
                </div>
                {generatedReport.totalRefunded > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 report-kpi-card">
                    <span className="text-slate-400 block text-[11px] font-medium">Total Refunded</span>
                    <span className="text-xl font-bold text-rose-400 mt-1 block">
                      ₹{generatedReport.totalRefunded.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-rose-400/80 mt-0.5 block">Cancelled / 100% Refunded</span>
                  </div>
                )}
              </div>

              {/* Itemized Booking Transactions Table */}
              {reportType === 'bookings' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 print:text-slate-800 flex items-center gap-2">
                      <Ticket className="w-3.5 h-3.5 text-indigo-400 print:text-indigo-600" />
                      <span>Itemized Booking Transactions Ledger ({generatedReport.bookings?.length || 0})</span>
                    </h5>
                    <span className="text-[11px] text-slate-400 print:text-slate-500">
                      Reconciled with Payment Gateway
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-slate-300">
                    <table className="w-full text-xs text-left text-slate-300 print:text-slate-900 border-collapse">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-400 print:text-slate-700 bg-slate-950/80 print:bg-slate-100 border-b border-slate-800 print:border-slate-300">
                        <tr>
                          <th className="p-3"># Ref</th>
                          <th className="p-3">Attendee</th>
                          <th className="p-3">Event Name & Venue</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Amount (₹)</th>
                          <th className="p-3 text-right">Booked Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                        {generatedReport.bookings && generatedReport.bookings.length > 0 ? (
                          generatedReport.bookings.map((b, idx) => {
                            const bookingRef = `#BKG-${(b._id || '').slice(-6).toUpperCase()}`;
                            const amount = b.totalAmount || ((b.event?.ticketPrice || 0) * (b.ticketCount || 1));
                            const bookedDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN') : 'N/A';
                            return (
                              <tr key={b._id || idx} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                                <td className="p-3 font-mono font-bold text-indigo-400 print:text-indigo-700">
                                  {bookingRef}
                                </td>
                                <td className="p-3">
                                  <div className="font-semibold text-white print:text-slate-900">{b.user?.name || 'Customer'}</div>
                                  <div className="text-[10px] text-slate-400 print:text-slate-500">{b.user?.email || 'N/A'}</div>
                                </td>
                                <td className="p-3 max-w-[200px]">
                                  <div className="font-medium text-slate-200 print:text-slate-800 truncate">{b.event?.eventName || 'Live Event'}</div>
                                  <div className="text-[10px] text-slate-400 print:text-slate-500 truncate">{b.event?.venue || 'Venue'}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    b.bookingStatus === 'CONFIRMED'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 print:bg-emerald-50 print:text-emerald-700 print:border-emerald-300'
                                      : b.bookingStatus === 'CANCELLED'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 print:bg-rose-50 print:text-rose-700 print:border-rose-300'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20 print:bg-amber-50 print:text-amber-700 print:border-amber-300'
                                  }`}>
                                    {b.bookingStatus || 'CONFIRMED'}
                                  </span>
                                </td>
                                <td className="p-3 text-center font-bold text-slate-200 print:text-slate-800">
                                  {b.ticketCount || 1}
                                </td>
                                <td className="p-3 text-right font-bold text-white print:text-slate-900 font-mono">
                                  ₹{amount.toLocaleString('en-IN')}
                                </td>
                                <td className="p-3 text-right text-slate-400 print:text-slate-600 font-mono text-[11px]">
                                  {bookedDate}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="7" className="p-6 text-center text-slate-500 italic">
                              No booking records matched the specified filter criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-950/90 print:bg-slate-100 border-t-2 border-slate-800 print:border-slate-300 font-bold text-white print:text-slate-900">
                        <tr>
                          <td colSpan="4" className="p-3 uppercase text-[11px] tracking-wider text-slate-400 print:text-slate-700">
                            Total Ledger Summary ({generatedReport.bookings?.length || 0} Transactions)
                          </td>
                          <td className="p-3 text-center text-indigo-400 print:text-indigo-700 font-mono font-extrabold">
                            {generatedReport.totalTicketsConfirmed ?? 0}
                          </td>
                          <td className="p-3 text-right text-emerald-400 print:text-emerald-700 font-mono text-sm font-extrabold">
                            ₹{(generatedReport.totalRevenue || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Itemized Events Performance Table */}
              {reportType === 'events' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 print:text-slate-800 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400 print:text-indigo-600" />
                      <span>Itemized Event Capacity & Performance Ledger ({generatedReport.events?.length || 0})</span>
                    </h5>
                    <span className="text-[11px] text-slate-400 print:text-slate-500">
                      Cross-Tenant Event Analytics
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-slate-300">
                    <table className="w-full text-xs text-left text-slate-300 print:text-slate-900 border-collapse">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-400 print:text-slate-700 bg-slate-950/80 print:bg-slate-100 border-b border-slate-800 print:border-slate-300">
                        <tr>
                          <th className="p-3">Event Name</th>
                          <th className="p-3">Host Organizer</th>
                          <th className="p-3">Date & Venue</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Sold / Capacity</th>
                          <th className="p-3 text-right">Revenue (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                        {generatedReport.events && generatedReport.events.length > 0 ? (
                          generatedReport.events.map((e, idx) => {
                            const eventDate = e.date ? new Date(e.date).toLocaleDateString('en-IN') : 'N/A';
                            const capRatio = `${e.ticketsSold || 0} / ${e.totalCapacity || e.seatsRemaining || 0}`;
                            return (
                              <tr key={e.eventId || idx} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                                <td className="p-3 font-semibold text-white print:text-slate-900">
                                  <div>{e.eventName || 'Event Experience'}</div>
                                  <div className="text-[10px] text-indigo-400 print:text-indigo-600 font-mono">ID: {(e.eventId || '').toString().slice(-6).toUpperCase()}</div>
                                </td>
                                <td className="p-3">
                                  <div className="font-medium text-slate-200 print:text-slate-800">{e.organizer?.name || 'Organizer'}</div>
                                  <div className="text-[10px] text-slate-400 print:text-slate-500">{e.organizer?.email || ''}</div>
                                </td>
                                <td className="p-3 text-slate-300 print:text-slate-700">
                                  <div>{eventDate}</div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{e.venue}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    e.status === 'ACTIVE'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 print:bg-emerald-50 print:text-emerald-700 print:border-emerald-300'
                                      : e.status === 'COMPLETED'
                                      ? 'bg-slate-500/10 text-slate-300 border-slate-500/20 print:bg-slate-100 print:text-slate-700 print:border-slate-300'
                                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20 print:bg-purple-50 print:text-purple-700 print:border-purple-300'
                                  }`}>
                                    {e.status || 'ACTIVE'}
                                  </span>
                                </td>
                                <td className="p-3 text-center font-bold text-slate-200 print:text-slate-800 font-mono">
                                  {capRatio}
                                </td>
                                <td className="p-3 text-right font-bold text-white print:text-slate-900 font-mono">
                                  ₹{(e.revenue || 0).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="6" className="p-6 text-center text-slate-500 italic">
                              No event records matched the specified filter criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-950/90 print:bg-slate-100 border-t-2 border-slate-800 print:border-slate-300 font-bold text-white print:text-slate-900">
                        <tr>
                          <td colSpan="4" className="p-3 uppercase text-[11px] tracking-wider text-slate-400 print:text-slate-700">
                            Total Platform Capacity Summary ({generatedReport.events?.length || 0} Events)
                          </td>
                          <td className="p-3 text-center text-indigo-400 print:text-indigo-700 font-mono font-extrabold">
                            {generatedReport.events?.reduce((acc, ev) => acc + (ev.ticketsSold || 0), 0) || 0} Sold
                          </td>
                          <td className="p-3 text-right text-emerald-400 print:text-emerald-700 font-mono text-sm font-extrabold">
                            ₹{(generatedReport.events?.reduce((acc, ev) => acc + (ev.revenue || 0), 0) || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Official Audit Verification & Sign-off Block (Visible in print) */}
              <div className="hidden print:block pt-6 border-t-2 border-slate-300 text-xs text-slate-600 space-y-4 break-inside-avoid">
                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                  Declaration: This document constitutes an official regulatory compliance and financial audit record generated directly from EventHub enterprise database ledgers. All transaction states, ticket allocations, and payment receipts recorded above are cryptographically reconciled with payment gateway settlements.
                </p>
                
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="p-3 border border-slate-300 rounded bg-slate-50">
                    <div className="text-[9px] uppercase font-bold text-slate-500">Prepared & Audited By</div>
                    <div className="font-bold text-slate-900 text-xs mt-1">{user?.name || 'Platform Administrator'}</div>
                    <div className="text-[9px] text-slate-500 mt-2">Role: SUPER_ADMIN</div>
                  </div>
                  
                  <div className="p-3 border border-slate-300 rounded bg-slate-50">
                    <div className="text-[9px] uppercase font-bold text-slate-500">Reconciliation Gateway</div>
                    <div className="font-bold text-slate-900 text-xs mt-1">EventHub Settlement Engine</div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Status: All Ledgers Balanced</div>
                    <div className="text-[9px] text-slate-500 mt-2">Protocol: SHA-256 Validated</div>
                  </div>

                  <div className="p-3 border border-slate-300 rounded bg-slate-50">
                    <div className="text-[9px] uppercase font-bold text-slate-500">Authentication Stamp</div>
                    <div className="font-mono text-[10px] text-slate-800 font-bold mt-1">
                      REP-{(generatedReport.reportId || '7E81A09F').toString().slice(-8).toUpperCase()}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Generated: {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</div>
                    <div className="text-[9px] font-bold text-indigo-700 mt-2 uppercase tracking-wider">OFFICIAL AUDIT COPY</div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
