import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as eventService from '../services/eventService';

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState({ query: '', category: '', location: '' });

  const fetchEvents = async (searchParams = null) => {
    setLoading(true);
    setError('');
    try {
      const { data } = searchParams
        ? await eventService.searchEvents(searchParams)
        : await eventService.getAllEvents();
      setEvents(data);
    } catch (err) {
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = {};
    if (search.query) params.query = search.query;
    if (search.category) params.category = search.category;
    if (search.location) params.location = search.location;
    fetchEvents(Object.keys(params).length ? params : null);
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Browse Events</h2>

      <form className="row g-2 mb-4" onSubmit={handleSearch}>
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by name..."
            value={search.query}
            onChange={(e) => setSearch({ ...search, query: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Category"
            value={search.category}
            onChange={(e) => setSearch({ ...search, category: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Location"
            value={search.location}
            onChange={(e) => setSearch({ ...search, location: e.target.value })}
          />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-primary w-100">Search</button>
        </div>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <p>Loading events...</p>}
      {!loading && events.length === 0 && <p className="text-muted">No events found.</p>}

      <div className="row g-4">
        {events.map((event) => (
          <div className="col-md-4" key={event._id}>
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <h5 className="card-title">{event.eventName}</h5>
                <p className="card-text text-muted mb-1">{event.category} · {event.venue}</p>
                <p className="card-text mb-1">
                  {new Date(event.date).toDateString()} · {event.time}
                </p>
                <p className="card-text fw-bold">₹{event.ticketPrice} · {event.availableSeats} seats left</p>
                <Link to={`/events/${event._id}`} className="btn btn-outline-primary btn-sm">
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
