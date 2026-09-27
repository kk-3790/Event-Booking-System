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
  Sparkles
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AttendeesModal from '../components/AttendeesModal';
import RewardDrawModal from '../components/RewardDrawModal';

const CATEGORIES = ['Technology', 'Concerts', 'Workshops', 'Networking', 'Sports'];

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Search & Filter within organizer listings
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal states: 'create' | 'edit' | 'delete' | null
  const [modalMode, setModalMode] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [attendeesEvent, setAttendeesEvent] = useState(null);
  const [rewardDrawEvent, setRewardDrawEvent] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Event Form State
  const initialForm = {
    eventName: '',
    category: 'Technology',
    venue: '',
    date: '',
    time: '10:00',
    endTime: '18:00',
    ticketPrice: '',
    availableSeats: '',
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchOrganizerEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await eventService.getAllEvents();
      // Filter events created by the logged-in organizer (or all if admin)
      const myEvents = data.filter(
        (e) => user?.role === 'ADMIN' || e.organizer?._id === user?.id || e.organizer === user?.id
      );
      setEvents(myEvents);
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

  // Open Edit Modal
  const openEditModal = (event) => {
    setActiveEvent(event);
    setFormData({
      eventName: event.eventName || '',
      category: event.category || 'Technology',
      venue: event.venue || '',
      date: event.date ? new Date(event.date).toISOString().slice(0, 10) : '',
      time: event.time || '10:00',
      endTime: event.endTime || '18:00',
      ticketPrice: event.ticketPrice ?? '',
      availableSeats: event.availableSeats ?? '',
    });
    setModalError('');
    setModalMode('edit');
  };

  // Open Delete Modal
  const openDeleteModal = (event) => {
    setActiveEvent(event);
    setModalError('');
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveEvent(null);
    setModalError('');
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
    if (formData.time >= formData.endTime) {
      setModalError('End Time must be later than Start Time.');
      return;
    }
    if (Number(formData.ticketPrice) < 0) {
      setModalError('Ticket Price cannot be negative.');
      return;
    }
    if (Number(formData.availableSeats) < 1) {
      setModalError('Available Seats must be at least 1.');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        ...formData,
        ticketPrice: Number(formData.ticketPrice),
        availableSeats: Number(formData.availableSeats),
      };

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
    if (selectedCategory !== 'All' && e.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesName = e.eventName?.toLowerCase().includes(q);
      const matchesVenue = e.venue?.toLowerCase().includes(q);
      if (!matchesName && !matchesVenue) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs flex items-center justify-between shadow-xl">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold mb-2">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>Organizer Studio</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Event Management Studio
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Welcome back, <span className="text-white font-semibold">{user?.name || 'Organizer'}</span>. Monitor ticket velocity and publish new experiences.
          </p>
        </div>

        <Button variant="gradient" size="md" onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Publish New Event</span>
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
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

      {/* Listings Table Controls */}
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
                const formattedDate = event.date
                  ? new Date(event.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A';

                return (
                  <tr key={event._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-bold text-white max-w-[200px] truncate">
                      {event.eventName}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                        {event.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      <div>{formattedDate}</div>
                      <div className="text-[10px] text-slate-500">{event.time} – {event.endTime}</div>
                    </td>
                    <td className="p-3.5 text-slate-400 max-w-[150px] truncate">
                      {event.venue}
                    </td>
                    <td className="p-3.5 font-extrabold text-white">
                      ₹{event.ticketPrice?.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                        {event.availableSeats} seats
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        {event.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setRewardDrawEvent(event)}
                        className="inline-flex p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition cursor-pointer"
                        title="Configure Lucky Draw & Promotional Discount"
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
                      <Link
                        to={`/events/${event._id}`}
                        target="_blank"
                        className="inline-flex p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="View Live Listing"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => openEditModal(event)}
                        className="inline-flex p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 transition cursor-pointer"
                        title="Edit Event"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(event)}
                        className="inline-flex p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                        title="Delete Event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>

      </div>

      {/* ================= MODAL: CREATE / EDIT EVENT ================= */}
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
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />

                <Input
                  label="Start Time (HH:MM)"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />

                <Input
                  label="End Time (HH:MM)"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Ticket Price (₹)"
                  type="number"
                  min="0"
                  placeholder="499"
                  value={formData.ticketPrice}
                  onChange={(e) => setFormData({ ...formData, ticketPrice: e.target.value })}
                  required
                />

                <Input
                  label="Available Seats (Inventory)"
                  type="number"
                  min="1"
                  placeholder="150"
                  value={formData.availableSeats}
                  onChange={(e) => setFormData({ ...formData, availableSeats: e.target.value })}
                  required
                />
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

    </div>
  );
}


