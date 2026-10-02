import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as eventService from '../services/eventService';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Tag, 
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw
} from 'lucide-react';
import Button from '../components/ui/Button';

// Category color schemes for event header gradients
const categoryStyles = {
  Technology: {
    gradient: 'from-indigo-900 via-indigo-950 to-slate-900',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
    bar: 'from-indigo-500 to-purple-500',
    tagColor: 'text-indigo-400',
  },
  Concerts: {
    gradient: 'from-pink-900 via-purple-950 to-slate-900',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
    bar: 'from-pink-500 to-rose-500',
    tagColor: 'text-pink-400',
  },
  Workshops: {
    gradient: 'from-emerald-950 via-teal-950 to-slate-900',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    bar: 'from-teal-500 to-emerald-500',
    tagColor: 'text-emerald-400',
  },
  Networking: {
    gradient: 'from-amber-950 via-orange-950 to-slate-900',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    bar: 'from-amber-500 to-orange-500',
    tagColor: 'text-amber-400',
  },
  Sports: {
    gradient: 'from-sky-950 via-blue-950 to-slate-900',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    bar: 'from-sky-500 to-blue-500',
    tagColor: 'text-sky-400',
  },
  Default: {
    gradient: 'from-slate-800 via-slate-900 to-slate-950',
    badge: 'bg-slate-700/40 text-slate-300 border-slate-600/30',
    bar: 'from-indigo-500 to-slate-500',
    tagColor: 'text-slate-400',
  },
};

const STANDARD_CATEGORIES = ['Technology', 'Concerts', 'Workshops', 'Networking', 'Sports'];
const CATEGORIES = ['All', ...STANDARD_CATEGORIES, 'Other'];

const getNormalizedCategory = (category) => {
  if (!category || !STANDARD_CATEGORIES.includes(category)) {
    return 'Other';
  }
  return category;
};

export default function EventList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If logged in as Organizer or Admin, redirect away from customer Browse Events to their dedicated hub
  useEffect(() => {
    if (user?.role === 'ORGANIZER') {
      navigate('/organizer/events', { replace: true });
    } else if (user?.role === 'ADMIN') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Unified Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('date-asc');

  // Fetch initial events from backend
  const fetchInitialEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await eventService.getAllEvents();
      setAllEvents(data || []);
    } catch {
      setError('Unable to fetch live events from server. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialEvents();
  }, []);

  // Instant real-time filtering: searches across event name, venue, city, category, and organizer
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      // 1. Unified Search matching eventName, venue/city, category, or organizer
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = event.eventName?.toLowerCase().includes(q);
        const matchesVenue = event.venue?.toLowerCase().includes(q);
        const matchesCat = event.category?.toLowerCase().includes(q);
        const matchesOrg = event.organizer?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesVenue && !matchesCat && !matchesOrg) {
          return false;
        }
      }

      // 2. Category Filter
      if (activeCategory !== 'All') {
        const eventCat = getNormalizedCategory(event.category);
        if (activeCategory === 'Other') {
          if (eventCat !== 'Other') return false;
        } else if (eventCat.toLowerCase() !== activeCategory.toLowerCase()) {
          return false;
        }
      }

      // 3. Date Filter
      if (dateFilter) {
        const eventDateStr = new Date(event.date).toISOString().slice(0, 10);
        if (eventDateStr !== dateFilter) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, searchQuery, dateFilter, activeCategory]);

  // Client-side sorting for instantaneous re-ordering
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'price-low') return a.ticketPrice - b.ticketPrice;
      if (sortBy === 'price-high') return b.ticketPrice - a.ticketPrice;
      if (sortBy === 'seats') return b.availableSeats - a.availableSeats;
      return 0;
    });
  }, [filteredEvents, sortBy]);

  // Debounced background sync with backend /events/search when query changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim() || dateFilter) {
        setIsSearching(true);
        try {
          const params = {};
          if (searchQuery.trim()) {
            params.query = searchQuery.trim();
            params.location = searchQuery.trim();
          }
          if (activeCategory !== 'All') params.category = activeCategory;
          if (dateFilter) params.date = dateFilter;

          const { data } = await eventService.searchEvents(params);
          if (Array.isArray(data) && data.length > 0) {
            // Merge newly found server events without duplicating
            setAllEvents((prev) => {
              const existingIds = new Set(prev.map((e) => e._id));
              const fresh = data.filter((e) => !existingIds.has(e._id));
              return fresh.length ? [...prev, ...fresh] : prev;
            });
          }
        } catch {
          // Handled client-side smoothly
        } finally {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, dateFilter, activeCategory]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setActiveCategory('All');
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() || dateFilter || activeCategory !== 'All'
  );

  return (
    <div className="min-h-screen pb-16 space-y-10">
      
      {/* ================= HERO SECTION ================= */}
      <section className="relative px-4 lg:px-8 pt-10 pb-6 max-w-7xl mx-auto w-full">
        <div className="relative rounded-3xl overflow-hidden p-8 md:p-14 border border-indigo-500/20 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950/80 shadow-2xl">
          
          {/* Ambient Glowing Blobs */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Smart Unified Search • Real-time Auto Filter</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Discover & Book <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Unforgettable Experiences
              </span>
            </h1>

            <p className="text-slate-400 text-sm md:text-base max-w-xl">
              Type any event title, venue, city, or topic for instant real-time results as you type.
            </p>
          </div>

          {/* Unified Merged Search Toolbar */}
          <div className="relative mt-8 p-3 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl glass-card space-y-3">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              
              {/* Unified Search Input (Title, Venue, City, Topic, Organizer) */}
              <div className="md:col-span-8 relative flex items-center bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <Search className={`w-4 h-4 mr-3 shrink-0 transition-colors ${searchQuery ? 'text-indigo-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  placeholder="Search by event title, venue, city (e.g. Ahmedabad), or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-sm w-full focus:outline-none placeholder-slate-500 text-slate-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer mr-2 shrink-0"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono shrink-0 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>LIVE</span>
                </div>
              </div>

              {/* Date Filter Input */}
              <div className="md:col-span-4 relative flex items-center bg-slate-950 border border-slate-800/80 rounded-xl px-3.5 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <Calendar className={`w-4 h-4 mr-2.5 shrink-0 transition-colors ${dateFilter ? 'text-indigo-400' : 'text-slate-500'}`} />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-sm w-full focus:outline-none text-slate-200 cursor-pointer"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Clear date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>

            {/* Category Pills Bar & Live Status Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-800/70 text-xs">
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-slate-400 font-medium mr-1 shrink-0 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Categories:</span>
                </span>

                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all duration-150 shrink-0 cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Reset Filters / Live Counter */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset filters</span>
                </button>
              )}

            </div>

          </div>

        </div>
      </section>

      {/* ================= EVENTS CATALOGUE ================= */}
      <section className="px-4 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Section Header & Sorter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">Upcoming Experiences</h2>
              {isSearching && (
                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-medium animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                  Searching...
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              {hasActiveFilters
                ? `Filtered results matching "${searchQuery || activeCategory}"`
                : `Explore active events with real-time seat availability`}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="date-asc">Upcoming Date</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="seats">Most Seats Available</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchInitialEvents} className="underline font-semibold cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="rounded-3xl bg-slate-900/40 border border-slate-800 p-5 space-y-4 animate-pulse">
                <div className="h-44 bg-slate-800/60 rounded-2xl"></div>
                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                <div className="h-3 bg-slate-800/60 rounded w-1/2"></div>
                <div className="h-8 bg-slate-800/40 rounded-xl"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && sortedEvents.length === 0 && (
          <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800 max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto text-2xl">
              🔍
            </div>
            <h3 className="text-lg font-bold text-white">No matching events found</h3>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              No events matched &quot;{searchQuery || activeCategory}&quot;. Try searching another city, venue, or keyword.
            </p>
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset all filters
            </Button>
          </div>
        )}

        {/* Event Cards Grid */}
        {!loading && sortedEvents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedEvents.map((event) => {
              const theme = categoryStyles[event.category] || categoryStyles.Default;
              const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              // Rough capacity estimate for progress display
              const capacity = event.availableSeats > 50 ? event.availableSeats + 40 : 100;
              const filledPercentage = Math.min(100, Math.round(((capacity - event.availableSeats) / capacity) * 100));
              const isUrgent = event.availableSeats < 25;

              return (
                <article
                  key={event._id}
                  className="group rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl overflow-hidden flex flex-col justify-between glass-card"
                >
                  <div>
                    {/* Header Thumbnail Gradient & Banner Image */}
                    <div className={`relative h-48 bg-gradient-to-br ${theme.gradient} overflow-hidden p-5 flex flex-col justify-between`}>
                      {event.bannerImage ? (
                        <>
                          <img
                            src={event.bannerImage.startsWith('http') ? event.bannerImage : `http://localhost:5001${event.bannerImage}`}
                            alt={event.eventName}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/30 pointer-events-none" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] opacity-10 pointer-events-none"></div>
                      )}

                      <div className="relative z-10 flex items-center justify-between">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider backdrop-blur-md border ${theme.badge}`}>
                          {getNormalizedCategory(event.category)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {event.ticketTiers && event.ticketTiers.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 backdrop-blur-md">
                              {event.ticketTiers.length} Tiers
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/80 backdrop-blur-md">
                              Standard Pass
                            </span>
                          )}
                          {isUrgent ? (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1 backdrop-blur-md">
                              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                              <span>Fast Selling</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1 backdrop-blur-md">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative z-10 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-200/90 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-300" />
                            {formattedDate}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-300" />
                            {event.time}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                          {event.eventName}
                        </h3>
                      </div>
                    </div>

                    {/* Card Body Info */}
                    <div className="p-5 space-y-4">
                      <div className="space-y-1.5 text-xs text-slate-400">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-1 text-slate-300">{event.venue}</span>
                        </div>
                        {event.organizer?.name && (
                          <p className="text-[11px] text-slate-500 pl-6 truncate">
                            Organized by <span className="text-slate-400">{event.organizer.name}</span>
                          </p>
                        )}
                      </div>

                      {/* Available Seats Progress */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Availability</span>
                          <span className={`font-semibold ${isUrgent ? 'text-amber-400' : 'text-indigo-400'}`}>
                            {event.availableSeats} seats left
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                          <div
                            className={`h-full bg-gradient-to-r ${theme.bar} rounded-full transition-all duration-500`}
                            style={{ width: `${filledPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-5 pt-0">
                    <div className="flex items-center justify-between pt-3.5 border-t border-slate-800/80">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          {event.ticketTiers && event.ticketTiers.length > 1 ? 'Tickets from' : 'Ticket Price'}
                        </span>
                        <span className="text-xl font-black text-white">
                          ₹{(event.ticketTiers && event.ticketTiers.length > 0
                            ? Math.min(...event.ticketTiers.map((t) => t.price))
                            : (event.ticketPrice || 0)
                          ).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <Link
                        to={`/events/${event._id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all active:scale-[0.98]"
                      >
                        <span>Book Now</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                </article>
              );
            })}
          </div>
        )}

      </section>

    </div>
  );
}
