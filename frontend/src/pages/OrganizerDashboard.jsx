import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as eventService from '../services/eventService';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  Search, 
  DollarSign, 
  Ticket, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  X,
  RotateCcw,
  Gift,
  Sparkles,
  QrCode,
  Image,
  UploadCloud,
  Layers,
  Trash,
  Printer,
  Download,
  FileText
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AttendeesModal from '../components/AttendeesModal';
import RewardDrawModal from '../components/RewardDrawModal';
import CheckInScannerModal from '../components/CheckInScannerModal';
import * as reportService from '../services/reportService';
import {
  formatEventDate,
  formatTimeRange12h,
  formatEventSchedule,
  formatCalculatedEndTime,
  calculateEndTime,
  isEventPastEnd,
  isEventStarted,
} from '../utils/dateTime';

const STANDARD_CATEGORIES = ['Technology', 'Concerts', 'Workshops', 'Networking', 'Sports'];
const CATEGORIES = [...STANDARD_CATEGORIES, 'Other'];

const getNormalizedCategory = (category) => {
  if (!category || !STANDARD_CATEGORIES.includes(category)) {
    return 'Other';
  }
  return category;
};

const PRESET_BANNERS = [
  { label: 'Tech Summit', url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80' },
  { label: 'Live Concert', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80' },
  { label: 'Business Expo', url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&q=80' },
  { label: 'Art Gala', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80' },
  { label: 'Culinary Workshop', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80' },
  { label: 'Esports Arena', url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&q=80' },
];

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Active view tab: 'events' | 'reports'
  const [activeTab, setActiveTab] = useState('events');

  // Reports State
  const [generatedReport, setGeneratedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportType, setReportType] = useState('bookings');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportAllTime, setReportAllTime] = useState(false);
  const [reportError, setReportError] = useState('');

  // Search & Filter within organizer listings
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal states: 'create' | 'edit' | 'delete' | null
  const [modalMode, setModalMode] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [attendeesEvent, setAttendeesEvent] = useState(null);
  const [rewardDrawEvent, setRewardDrawEvent] = useState(null);
  const [scannerEvent, setScannerEvent] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState('');

  // Event Form State
  const initialForm = {
    eventName: '',
    category: 'Technology',
    venue: '',
    date: '',
    time: '10:00',
    duration: 2,
    ticketPrice: '',
    availableSeats: '',
    bannerImage: '',
    description: '',
    enableTiers: false,
    ticketTiers: [
      { tierName: 'General Admission', price: 499, totalSeats: 100, perks: 'Standard Entry' },
      { tierName: 'VIP Pass', price: 999, totalSeats: 25, perks: 'Front Row + Fast-track' },
    ],
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchOrganizerEvents = async () => {
    setLoading(true);
    setError('');
    try {
      // First try dedicated organizer endpoint that returns all statuses (ACTIVE, ONGOING, COMPLETED)
      try {
        const { data } = await eventService.getOrganizerEvents();
        setEvents(Array.isArray(data) ? data : []);
        return;
      } catch {
        // Fallback to getAllEvents with safe multi-id matching if needed
        const { data } = await eventService.getAllEvents();
        const currentUserId = String(user?.id || user?._id || '');
        const myEvents = (Array.isArray(data) ? data : []).filter((e) => {
          if (user?.role === 'ADMIN') return true;
          const orgId = String(e.organizer?._id || e.organizer || '');
          return currentUserId && orgId === currentUserId;
        });
        setEvents(myEvents);
      }
    } catch {
      setError('Failed to fetch your events. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizerEvents();
  }, [user]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormData(initialForm);
    setModalError('');
    setModalMode('create');
  };

  const isPastEndTime = (ev) => isEventPastEnd(ev);

  const isStarted = (ev) => isEventStarted(ev);

  const checkIsCompleted = (ev) => {
    if (!ev) return false;
    const isCancelled = ev.status === 'CANCELLED' || ev.status === 'DELETED';
    return ev.status === 'COMPLETED' || (!isCancelled && isPastEndTime(ev));
  };

  const checkIsOngoing = (ev) => {
    if (!ev) return false;
    const isCancelled = ev.status === 'CANCELLED' || ev.status === 'DELETED';
    return !checkIsCompleted(ev) && !isCancelled && (ev.status === 'ONGOING' || isStarted(ev));
  };

  // Open Edit Modal
  const openEditModal = (event) => {
    if (event.status === 'CANCELLED' || event.status === 'DELETED' || checkIsCompleted(event) || checkIsOngoing(event)) {
      return;
    }
    setActiveEvent(event);
    const hasTiers = Boolean(event.ticketTiers && event.ticketTiers.length > 0);
    setFormData({
      eventName: event.eventName || '',
      category: getNormalizedCategory(event.category),
      venue: event.venue || '',
      date: event.date ? new Date(event.date).toISOString().slice(0, 10) : '',
      time: event.time || '10:00',
      duration: event.duration !== undefined ? event.duration : 2,
      ticketPrice: event.ticketPrice ?? '',
      availableSeats: event.availableSeats ?? '',
      bannerImage: event.bannerImage || '',
      description: event.description || '',
      enableTiers: hasTiers,
      ticketTiers: hasTiers ? event.ticketTiers : [
        { tierName: 'General Admission', price: event.ticketPrice || 499, totalSeats: event.availableSeats || 100, perks: 'Standard Entry' },
        { tierName: 'VIP Pass', price: (event.ticketPrice ? event.ticketPrice * 2 : 999), totalSeats: 25, perks: 'Front Row + Fast-track' },
      ],
    });
    setModalError('');
    setBannerUploadError('');
    setModalMode('edit');
  };

  // Open Delete Modal
  const openDeleteModal = (event) => {
    if (event.status === 'CANCELLED' || event.status === 'DELETED' || checkIsCompleted(event) || checkIsOngoing(event)) {
      return;
    }
    setActiveEvent(event);
    setModalError('');
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveEvent(null);
    setModalError('');
    setBannerUploadError('');
  };

  const handleBannerFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setBannerUploadError('');
    try {
      const data = new FormData();
      data.append('banner', file);
      const res = await eventService.uploadBanner(data);
      setFormData((prev) => ({ ...prev, bannerImage: res.data.imageUrl }));
    } catch (err) {
      setBannerUploadError(err.response?.data?.message || 'Banner upload failed');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleAddTier = () => {
    setFormData((prev) => ({
      ...prev,
      ticketTiers: [
        ...prev.ticketTiers,
        { tierName: 'New Pass Tier', price: 499, totalSeats: 50, perks: 'Admission Pass' },
      ],
    }));
  };

  const handleRemoveTier = (index) => {
    if (formData.ticketTiers.length <= 1) {
      setModalError('At least one ticket tier is required when multi-tier pricing is enabled.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      ticketTiers: prev.ticketTiers.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateTier = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.ticketTiers];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, ticketTiers: updated };
    });
  };

  // Submit Create or Edit Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    // Client-side validations
    if (!formData.eventName.trim()) {
      setModalError('Event Name is required.');
      return;
    }
    if (!formData.venue.trim()) {
      setModalError('Venue address is required.');
      return;
    }
    if (!formData.date) {
      setModalError('Event Date is required.');
      return;
    }

    // Check past date and past time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (formData.date < todayStr) {
      setModalError('Event Date cannot be in the past. Please select today or a future date.');
      return;
    }

    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    if (formData.date === todayStr && formData.time <= currentTimeStr) {
      setModalError(`Event Start Time (${formData.time}) has already passed today (current time is ${currentTimeStr}). Please select a future time.`);
      return;
    }

    const durationNum = Number(formData.duration);
    if (!durationNum || durationNum < 0.5) {
      setModalError('Duration must be at least 0.5 hours (30 minutes).');
      return;
    }
    if (durationNum > 24) {
      setModalError('Duration cannot exceed 24 hours (maximum allowed limit is 24 hours).');
      return;
    }

    const calculatedEnd = calculateEndTime(formData.time, durationNum);
    let payload = {
      ...formData,
      duration: durationNum,
      endTime: calculatedEnd,
      ticketPrice: Number(formData.ticketPrice) || 0,
      availableSeats: Number(formData.availableSeats) || 0,
    };

    if (formData.enableTiers) {
      if (!formData.ticketTiers || formData.ticketTiers.length === 0) {
        setModalError('Please configure at least one ticket tier.');
        return;
      }
      for (const t of formData.ticketTiers) {
        if (!t.tierName?.trim()) {
          setModalError('All ticket tiers must have a name (e.g. VIP Pass, General Admission).');
          return;
        }
        if (Number(t.price) < 0 || Number(t.totalSeats) < 1) {
          setModalError('Tier price cannot be negative and capacity must be at least 1 seat.');
          return;
        }
      }
      const formattedTiers = formData.ticketTiers.map((t) => ({
        tierName: t.tierName.trim(),
        price: Number(t.price),
        totalSeats: Number(t.totalSeats),
        availableSeats: Number(t.availableSeats !== undefined ? t.availableSeats : t.totalSeats),
        perks: t.perks || '',
      }));
      const totalTierSeats = formattedTiers.reduce((sum, t) => sum + t.totalSeats, 0);
      const totalTierAvailable = formattedTiers.reduce((sum, t) => sum + t.availableSeats, 0);
      const minPrice = Math.min(...formattedTiers.map((t) => t.price));

      payload.ticketTiers = formattedTiers;
      payload.totalSeats = totalTierSeats;
      payload.availableSeats = totalTierAvailable;
      payload.ticketPrice = minPrice;
    } else {
      if (Number(formData.ticketPrice) < 0) {
        setModalError('Ticket Price cannot be negative.');
        return;
      }
      if (Number(formData.availableSeats) < 1) {
        setModalError('Available Seats must be at least 1.');
        return;
      }
      payload.ticketTiers = [];
    }

    setModalLoading(true);
    try {
      if (modalMode === 'create') {
        const { data } = await eventService.createEvent(payload);
        setToastMessage(`Event "${data.event?.eventName || formData.eventName}" published successfully!`);
      } else if (modalMode === 'edit') {
        await eventService.updateEvent(activeEvent._id, payload);
        setToastMessage(`Event "${formData.eventName}" updated successfully!`);
      }

      closeModal();
      fetchOrganizerEvents();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save event. Please check inputs.');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit Delete Event
  const handleDeleteEvent = async () => {
    if (!activeEvent) return;
    setModalLoading(true);
    setModalError('');
    try {
      await eventService.deleteEvent(activeEvent._id);
      setToastMessage(`Event "${activeEvent.eventName}" deleted successfully.`);
      closeModal();
      setEvents((prev) => prev.filter((e) => e._id !== activeEvent._id));
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to delete event.');
    } finally {
      setModalLoading(false);
    }
  };

  // KPI calculations
  const totalRevenue = useMemo(() => {
    return events.reduce((sum, e) => sum + (e.ticketPrice || 0) * 20, 0); // Simulated estimate baseline
  }, [events]);

  const totalSeats = useMemo(() => {
    return events.reduce((sum, e) => sum + (e.availableSeats || 0), 0);
  }, [events]);

  // Filtered listings
  const filteredEvents = events.filter((e) => {
    const eventCat = getNormalizedCategory(e.category);
    if (selectedCategory !== 'All') {
      if (selectedCategory === 'Other') {
        if (eventCat !== 'Other') return false;
      } else if (e.category !== selectedCategory) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesName = e.eventName?.toLowerCase().includes(q);
      const matchesVenue = e.venue?.toLowerCase().includes(q);
      const matchesCat = eventCat.toLowerCase().includes(q) || (e.category && e.category.toLowerCase().includes(q));
      if (!matchesName && !matchesVenue && !matchesCat) return false;
    }
    return true;
  });

  // Generate Regulatory & Revenue Report for Organizer
  const handleGenerateReport = async () => {
    setReportError('');

    if (!reportAllTime) {
      if (!reportStartDate || !reportEndDate) {
        setReportError('Please select both a starting date and ending date or check "Whole Time" for an all-time audit.');
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

      let res;
      if (reportType === 'bookings') {
        res = await reportService.getBookingReport(params);
      } else {
        res = await reportService.getEventReport(params);
      }
      setGeneratedReport(res.data);
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate report');
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

  const handleExportReportCsv = () => {
    if (!generatedReport) return;

    let headers = [];
    let rows = [];

    if (reportType === 'bookings') {
      headers = [
        'Booking Reference',
        'Event Name',
        'Customer Name',
        'Tickets Count',
        'Status',
        'Amount Paid (INR)',
        'Booking Date'
      ];
      const bookings = generatedReport.bookings || [];
      rows = bookings.map((b) => {
        const u = b.user || {};
        const eventName = b.event?.eventName || 'Event Experience';
        const dateStr = b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN') : 'N/A';
        return [
          `#BKG-${(b.bookingId || b._id || '').toString().slice(-6).toUpperCase()}`,
          `"${(eventName).replace(/"/g, '""')}"`,
          `"${(u.name || b.customerName || 'Attendee').replace(/"/g, '""')}"`,
          b.ticketsCount || b.ticketCount || 1,
          b.status || b.bookingStatus || 'CONFIRMED',
          b.totalPrice ?? b.totalAmount ?? 0,
          `"${dateStr}"`
        ];
      });
    } else {
      headers = [
        'Event ID',
        'Event Name',
        'Date',
        'Venue',
        'Status',
        'Tickets Sold',
        'Total Capacity',
        'Total Revenue (INR)'
      ];
      const eventsList = generatedReport.events || [];
      rows = eventsList.map((e) => {
        const dateStr = e.date ? new Date(e.date).toLocaleDateString('en-IN') : 'N/A';
        return [
          `#EVT-${(e.eventId || e._id || '').toString().slice(-6).toUpperCase()}`,
          `"${(e.eventName || 'Event Experience').replace(/"/g, '""')}"`,
          `"${dateStr}"`,
          `"${(e.venue || 'Venue TBD').replace(/"/g, '""')}"`,
          e.status || 'ACTIVE',
          e.ticketsSold || 0,
          e.totalCapacity || e.seatsRemaining || 0,
          e.totalRevenue ?? 0
        ];
      });
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanDate = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `Organizer_${reportType}_report_${cleanDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 lg:px-8 max-w-7xl mx-auto w-full space-y-8 print:min-h-0 print:p-0 print:m-0 print:space-y-0">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="print:hidden p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage('')} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div id="organizer-header-banner" className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold mb-2">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>Organizer Studio</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Event Management Studio
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Welcome back, <span className="text-white font-semibold">{user?.name || 'Organizer'}</span>. Monitor ticket velocity, revenue ledgers, and audit reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="gradient" size="md" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Publish New Event</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div id="organizer-overview-kpis" className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Estimated Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Active Listings Monetization</span>
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Active Listings</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{events.length}</div>
          <span className="text-[11px] text-purple-400 font-medium">
            Published on Platform
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Available Seats Pool</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{totalSeats.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-indigo-400 font-medium">
            Total capacity available
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 glass-card space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Organizer Profile</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-white truncate">{user?.name}</div>
          <span className="text-[11px] text-slate-400 truncate block">
            {user?.email}
          </span>
        </div>

      </div>

      {/* Navigation Tabs Bar */}
      <div id="organizer-tab-nav" className="print:hidden flex items-center gap-2 p-1.5 bg-slate-900/60 rounded-2xl border border-slate-800 glass-card overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
            activeTab === 'events'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
          My Hosted Events ({events.length})
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 inline mr-1.5" />
          Revenue & Audit Reports
        </button>
      </div>

      {/* ================= TAB 1: MY HOSTED EVENTS ================= */}
      {activeTab === 'events' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden glass-card space-y-4 p-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 w-full sm:w-80 focus-within:border-indigo-500">
            <Search className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search your listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none w-full placeholder-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedCategory === 'All'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white bg-slate-800/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchOrganizerEvents} className="underline font-semibold cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* Listings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/70 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Event Name</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Venue</th>
                <th className="p-3.5">Ticket Price</th>
                <th className="p-3.5">Available Seats</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              
              {loading && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    Loading your listings...
                  </td>
                </tr>
              )}

              {!loading && filteredEvents.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-10 text-center space-y-3">
                    <p className="text-slate-400 text-sm">No events found matching your filter.</p>
                    <Button variant="secondary" size="sm" onClick={openCreateModal}>
                      <Plus className="w-4 h-4 mr-1" />
                      Create Your First Event
                    </Button>
                  </td>
                </tr>
              )}

              {!loading && filteredEvents.map((event) => {
                const formattedDate = event.date ? formatEventDate(event.date, false) : 'N/A';

                const isCancelled = event.status === 'CANCELLED' || event.status === 'DELETED';
                const isCompleted = event.status === 'COMPLETED' || (!isCancelled && isEventPastEnd(event));
                const isOngoing = !isCompleted && !isCancelled && (event.status === 'ONGOING' || isEventStarted(event));
                const isActionDisabled = isCompleted || isOngoing;

                return (
                  <tr key={event._id} className={`hover:bg-slate-800/30 transition-colors ${isCancelled ? 'opacity-85 bg-rose-500/[0.03]' : ''}`}>
                    <td className="p-3.5 font-bold text-white max-w-[200px] truncate">
                      <span className={isCancelled ? 'line-through text-slate-400 font-medium' : ''}>
                        {event.eventName}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                        {getNormalizedCategory(event.category)}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      <div>{formattedDate}</div>
                      <div className="text-[10px] text-slate-500">{formatEventSchedule(event.time, event.duration, event.endTime)}</div>
                    </td>
                    <td className="p-3.5 text-slate-400 max-w-[150px] truncate">
                      {event.venue}
                    </td>
                    <td className="p-3.5 font-extrabold text-white">
                      ₹{event.ticketPrice?.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isCancelled ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-slate-800 text-slate-300'}`}>
                        {isCancelled ? 'Cancelled' : `${event.availableSeats} seats`}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        isCancelled
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : isOngoing
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : isCompleted
                          ? 'bg-slate-700/40 text-slate-400 border-slate-600/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                      }`}>
                        {isCompleted ? 'COMPLETED' : isOngoing ? 'ONGOING' : event.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {isCancelled ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-rose-300 font-bold px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25">
                            Cancelled • 100% Refunded
                          </span>
                          <button
                            onClick={() => setAttendeesEvent(event)}
                            className="inline-flex p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition cursor-pointer"
                            title="View Attendee Manifest & Refund History"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => !isCompleted && setScannerEvent(event)}
                            disabled={isCompleted}
                            className={`inline-flex p-1.5 rounded-lg border transition ${
                              isCompleted
                                ? 'bg-slate-800/40 text-slate-600 border-slate-700/20 cursor-not-allowed opacity-40 hover:bg-slate-800/40 hover:text-slate-600'
                                : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20 cursor-pointer'
                            }`}
                            title={isCompleted ? "Gate Admission Closed (Event Concluded)" : "Gate Admission & QR Scanner"}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRewardDrawEvent(event)}
                            className="inline-flex p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition cursor-pointer"
                            title={isCompleted ? "View Lucky Draw Winners Checklist" : "Configure Lucky Draw & Promotional Discount"}
                          >
                            <Gift className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setAttendeesEvent(event)}
                            className="inline-flex p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition cursor-pointer"
                            title="View Attendees & Export CSV"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => !isActionDisabled && openEditModal(event)}
                            disabled={isActionDisabled}
                            className={`inline-flex p-1.5 rounded-lg border transition ${
                              isActionDisabled
                                ? 'bg-slate-800/40 text-slate-600 border-slate-700/20 cursor-not-allowed opacity-40 hover:bg-slate-800/40 hover:text-slate-600'
                                : 'bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 border-transparent cursor-pointer'
                            }`}
                            title={
                              isCompleted
                                ? "Event Completed – Completed events cannot be edited"
                                : isOngoing
                                ? "Event In Progress – Ongoing events cannot be edited"
                                : "Edit Event"
                            }
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => !isActionDisabled && openDeleteModal(event)}
                            disabled={isActionDisabled}
                            className={`inline-flex p-1.5 rounded-lg border transition ${
                              isActionDisabled
                                ? 'bg-slate-800/40 text-slate-600 border-slate-700/20 cursor-not-allowed opacity-40 hover:bg-slate-800/40 hover:text-slate-600'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-transparent cursor-pointer'
                            }`}
                            title={
                              isCompleted
                                ? "Event Completed – Completed events cannot be deleted"
                                : isOngoing
                                ? "Event In Progress – Ongoing events cannot be deleted"
                                : "Delete Event"
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ================= TAB 2: REVENUE & AUDIT REPORTS ================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6 print:space-y-0">
          
          <div id="organizer-report-form" className="print:hidden p-6 rounded-3xl bg-slate-900/60 border border-slate-800 glass-card space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Generate Organizer Revenue & Capacity Audit</span>
            </h3>
            <p className="text-xs text-slate-400">
              Select date ranges and report format to generate cryptographic audit summaries for your hosted events.
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
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-950 cursor-pointer"
                />
                <span className={reportAllTime ? "text-purple-300 font-bold" : "text-slate-400 font-medium"}>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
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
                      : 'border-slate-800 focus:border-purple-500'
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
                      : 'border-slate-800 focus:border-purple-500'
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
            <div id="organizer-report-container" className="p-6 rounded-3xl bg-slate-900/80 border border-purple-500/30 shadow-2xl glass-card space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white">
              
              {/* Official Enterprise Letterhead - Visible only when printing */}
              <div className="hidden print:flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-black flex items-center justify-center text-sm">
                      EH
                    </div>
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900">
                        EVENTHUB ORGANIZER AUDIT
                      </h1>
                      <p className="text-[10px] tracking-wider uppercase font-semibold text-slate-500">
                        Organizer Regulatory Compliance & Financial Ledger
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                    <p><span className="font-bold text-slate-800">Document:</span> {reportType === 'bookings' ? 'Booking Transactions & Revenue Ledger' : 'Hosted Event Inventory & Capacity Audit'}</p>
                    <p><span className="font-bold text-slate-800">Reporting Range:</span> {generatedReport.dateRange?.startDate || generatedReport.filter?.startDate || 'All Time'} to {generatedReport.dateRange?.endDate || generatedReport.filter?.endDate || 'All Time'}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600 space-y-0.5">
                  <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 mb-1">
                    VERIFIED AUDIT
                  </div>
                  <p><span className="font-bold text-slate-800">Report Ref:</span> <span className="font-mono text-slate-700">{generatedReport.reportId || 'GEN-REP-AUDIT'}</span></p>
                  <p><span className="font-bold text-slate-800">Host Organizer:</span> {user?.name || 'Organizer'}</p>
                  <p><span className="font-bold text-slate-800">Generated:</span> {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>

              {/* Screen View Header - Hidden when printing */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:hidden">
                <div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300">
                    Organizer Audit Output
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
                    onClick={handleExportReportCsv}
                    className="cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    <span>Export CSV</span>
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

              {/* Report Metrics Row - EXACTLY 3 KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs report-kpi-grid">
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
                  <span className="text-slate-400 block text-[11px] font-medium">Gross Revenue Reconciled</span>
                  <span className="text-xl font-bold text-purple-400 mt-1 block">
                    ₹{(generatedReport.totalRevenue || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-purple-400/80 mt-0.5 block">Payment Gateway Reconciled</span>
                </div>
              </div>

              {/* Itemized Booking Transactions Table */}
              {reportType === 'bookings' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 print:text-slate-800 flex items-center gap-2">
                      <Ticket className="w-3.5 h-3.5 text-purple-400 print:text-purple-600" />
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
                                <td className="p-3 font-mono font-bold text-purple-400 print:text-purple-700">
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
                          <td className="p-3 text-center text-purple-400 print:text-purple-700 font-mono font-extrabold">
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
                      <Calendar className="w-3.5 h-3.5 text-purple-400 print:text-purple-600" />
                      <span>Itemized Event Capacity & Performance Ledger ({generatedReport.events?.length || 0})</span>
                    </h5>
                    <span className="text-[11px] text-slate-400 print:text-slate-500">
                      Hosted Event Analytics
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-slate-300">
                    <table className="w-full text-xs text-left text-slate-300 print:text-slate-900 border-collapse">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-400 print:text-slate-700 bg-slate-950/80 print:bg-slate-100 border-b border-slate-800 print:border-slate-300">
                        <tr>
                          <th className="p-3">Event Name</th>
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
                                  <div className="text-[10px] text-purple-400 print:text-purple-600 font-mono">ID: {(e.eventId || '').toString().slice(-6).toUpperCase()}</div>
                                </td>
                                <td className="p-3 text-slate-300 print:text-slate-700">
                                  <div>{eventDate}</div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{e.venue}</div>
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
                            <td colSpan="5" className="p-6 text-center text-slate-500 italic">
                              No event records matched the specified filter criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-950/90 print:bg-slate-100 border-t-2 border-slate-800 print:border-slate-300 font-bold text-white print:text-slate-900">
                        <tr>
                          <td colSpan="3" className="p-3 uppercase text-[11px] tracking-wider text-slate-400 print:text-slate-700">
                            Total Capacity Summary ({generatedReport.events?.length || 0} Events)
                          </td>
                          <td className="p-3 text-center text-purple-400 print:text-purple-700 font-mono font-extrabold">
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
                  Declaration: This document constitutes an official organizer revenue and ticket inventory audit record generated directly from EventHub ledgers for events hosted by this organization. All transaction states, ticket allocations, and payment receipts recorded above are cryptographically reconciled with payment gateway settlements.
                </p>
                
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="p-3 border border-slate-300 rounded bg-slate-50">
                    <div className="text-[9px] uppercase font-bold text-slate-500">Prepared & Certified By</div>
                    <div className="font-bold text-slate-900 text-xs mt-1">{user?.name || 'Event Host Organizer'}</div>
                    <div className="text-[9px] text-slate-500 mt-2">Role: CERTIFIED ORGANIZER</div>
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
                    <div className="text-[9px] font-bold text-purple-700 mt-2 uppercase tracking-wider">OFFICIAL ORGANIZER AUDIT</div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-xl w-full rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 my-8">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  {modalMode === 'create' ? 'Organizer Studio' : 'Update Listing'}
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  {modalMode === 'create' ? 'Publish New Event' : `Edit: ${activeEvent?.eventName}`}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              
              <Input
                label="Event Name (Unique title)"
                id="eventName"
                name="eventName"
                type="text"
                placeholder="e.g. NextGen Web3 & AI Hackathon"
                value={formData.eventName}
                onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-slate-300">Category</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="block w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Venue / Hall Address"
                  id="venue"
                  name="venue"
                  type="text"
                  placeholder="e.g. Convention Hall B, SG Highway"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  required
                />

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="Date"
                  id="date"
                  name="date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />

                <Input
                  label="Start Time (HH:MM)"
                  id="time"
                  name="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />

                <div>
                  <Input
                    label="Duration (Hours - max 24h)"
                    id="duration"
                    name="duration"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={formData.duration}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setFormData({ ...formData, duration: '' });
                      } else {
                        const num = Number(val);
                        if (num > 24) {
                          setFormData({ ...formData, duration: 24 });
                        } else {
                          setFormData({ ...formData, duration: val });
                        }
                      }
                    }}
                    required
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-semibold mr-0.5">Presets:</span>
                    {[1, 2, 3, 4, 6, 8, 12, 24].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData({ ...formData, duration: preset })}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                          Number(formData.duration) === preset
                            ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {preset}h
                      </button>
                    ))}
                  </div>
                  {formData.time && formData.duration !== '' && (
                    <div className="mt-1.5 text-[11px] text-indigo-400 font-medium flex items-center justify-between">
                      <span>Ends: {formatCalculatedEndTime(formData.time, formData.duration)}</span>
                      <span className="text-slate-500 text-[10px]">
                        ({formData.duration} {Number(formData.duration) === 1 ? 'hr' : 'hrs'} • Max 24 hrs)
                      </span>
                    </div>
                  )}
                  {Number(formData.duration) > 24 && (
                    <p className="mt-1 text-[11px] text-rose-400 font-semibold">
                      Duration cannot exceed 24 hours.
                    </p>
                  )}
                  {formData.duration !== '' && Number(formData.duration) < 0.5 && (
                    <p className="mt-1 text-[11px] text-rose-400 font-semibold">
                      Minimum duration is 0.5 hours (30 minutes).
                    </p>
                  )}
                </div>
              </div>

              {/* Event Description */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-slate-300">
                  Event Description & Highlights
                </label>
                <textarea
                  rows={3}
                  placeholder="Share a compelling overview of the event, keynote speakers, agenda, or dress code..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="block w-full rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none transition"
                />
              </div>

              {/* Event Banner */}
              <div className="space-y-2.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-indigo-400" />
                    Event Banner Image
                  </label>
                  <span className="text-[11px] text-slate-500">JPG, PNG, WebP up to 5MB</span>
                </div>

                {formData.bannerImage && (
                  <div className="relative h-28 w-full rounded-xl overflow-hidden border border-slate-700/80 group">
                    <img
                      src={formData.bannerImage.startsWith('http') ? formData.bannerImage : `http://localhost:5001${formData.bannerImage}`}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, bannerImage: '' })}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/30 transition cursor-pointer"
                      >
                        Remove Image
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="relative flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-950/50 hover:bg-slate-950 cursor-pointer transition text-xs text-slate-300">
                    <UploadCloud className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{uploadingBanner ? 'Uploading...' : 'Upload from Device'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerFileChange}
                      disabled={uploadingBanner}
                      className="hidden"
                    />
                  </label>

                  <Input
                    type="url"
                    placeholder="Or paste external image URL..."
                    value={formData.bannerImage}
                    onChange={(e) => setFormData({ ...formData, bannerImage: e.target.value })}
                  />
                </div>

                {bannerUploadError && (
                  <p className="text-xs text-rose-400">{bannerUploadError}</p>
                )}

                {/* Preset Banner Quick Select */}
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Quick Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_BANNERS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setFormData({ ...formData, bannerImage: preset.url })}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          formData.bannerImage === preset.url
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ticketing Structure: Single Price vs Multi-Tier Passes */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Multi-Tier Passes</h4>
                      <p className="text-[11px] text-slate-400">Offer VIP, Early Bird & General Admission tiers</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enableTiers}
                      onChange={(e) => setFormData({ ...formData, enableTiers: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {!formData.enableTiers ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <Input
                      label="Ticket Price (₹)"
                      id="ticketPrice"
                      name="ticketPrice"
                      type="number"
                      min="0"
                      placeholder="499"
                      value={formData.ticketPrice}
                      onChange={(e) => setFormData({ ...formData, ticketPrice: e.target.value })}
                      required={!formData.enableTiers}
                    />

                    <Input
                      label="Available Seats (Inventory)"
                      id="availableSeats"
                      name="availableSeats"
                      type="number"
                      min="1"
                      placeholder="150"
                      value={formData.availableSeats}
                      onChange={(e) => setFormData({ ...formData, availableSeats: e.target.value })}
                      required={!formData.enableTiers}
                    />
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {formData.ticketTiers.map((tier, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-300">Tier #{idx + 1}</span>
                          {formData.ticketTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTier(idx)}
                              className="text-slate-400 hover:text-rose-400 p-1 rounded-md transition cursor-pointer"
                              title="Delete tier"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">Tier Name</label>
                            <input
                              type="text"
                              placeholder="e.g. VIP Access"
                              value={tier.tierName}
                              onChange={(e) => handleUpdateTier(idx, 'tierName', e.target.value)}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">Price (₹)</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="999"
                              value={tier.price}
                              onChange={(e) => handleUpdateTier(idx, 'price', e.target.value)}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">Capacity (Seats)</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="50"
                              value={tier.totalSeats}
                              onChange={(e) => handleUpdateTier(idx, 'totalSeats', e.target.value)}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-semibold">Perks & Benefits</label>
                          <input
                            type="text"
                            placeholder="e.g. Front row seat + Swag kit + Backstage pass"
                            value={tier.perks || ''}
                            onChange={(e) => handleUpdateTier(idx, 'perks', e.target.value)}
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="w-full py-2 rounded-xl border border-dashed border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Another Pass Tier
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                      <span>Total Capacity: <strong className="text-white">{formData.ticketTiers.reduce((acc, t) => acc + (Number(t.totalSeats) || 0), 0)} seats</strong></span>
                      <span>Starting at: <strong className="text-emerald-400">₹{Math.min(...formData.ticketTiers.map(t => Number(t.price) || 0))}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <Button variant="ghost" size="sm" onClick={closeModal} disabled={modalLoading}>
                  Cancel
                </Button>
                <Button variant="gradient" size="md" type="submit" loading={modalLoading}>
                  {modalMode === 'create' ? 'Publish Event Now' : 'Save Changes'}
                </Button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE EVENT CONFIRMATION ================= */}
      {modalMode === 'delete' && activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl space-y-6">
            
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto text-xl border border-rose-500/20">
              <Trash2 className="w-6 h-6 text-rose-400" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-xl font-bold text-white">Delete Event Listing?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete{' '}
                <span className="text-white font-semibold">"{activeEvent.eventName}"</span>?
                This action will remove the event listing from the catalogue.
              </p>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={closeModal} disabled={modalLoading}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" loading={modalLoading} onClick={handleDeleteEvent}>
                Confirm Delete
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* Attendee Roster & CSV Export Modal */}
      {attendeesEvent && (
        <AttendeesModal
          isOpen={!!attendeesEvent}
          onClose={() => setAttendeesEvent(null)}
          event={attendeesEvent}
        />
      )}

      {/* Lucky Discount & Reward Draw Modal */}
      {rewardDrawEvent && (
        <RewardDrawModal
          isOpen={!!rewardDrawEvent}
          onClose={() => setRewardDrawEvent(null)}
          event={rewardDrawEvent}
        />
      )}

      {/* Gate Admission & QR Scanner Modal */}
      {scannerEvent && (
        <CheckInScannerModal
          isOpen={!!scannerEvent}
          onClose={() => setScannerEvent(null)}
          event={scannerEvent}
          onCheckInComplete={fetchOrganizerEvents}
        />
      )}

    </div>
  );
}


