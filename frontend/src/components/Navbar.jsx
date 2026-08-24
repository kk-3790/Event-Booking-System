import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3">
      <Link className="navbar-brand" to="/">Event Booking System</Link>
      <div className="collapse navbar-collapse show">
        <ul className="navbar-nav me-auto">
          <li className="nav-item">
            <Link className="nav-link" to="/">Browse Events</Link>
          </li>
          {user?.role === 'CUSTOMER' && (
            <li className="nav-item">
              <Link className="nav-link" to="/my-bookings">My Bookings</Link>
            </li>
          )}
          {user?.role === 'ORGANIZER' && (
            <li className="nav-item">
              <Link className="nav-link" to="/organizer/events">My Events</Link>
            </li>
          )}
          {user?.role === 'ADMIN' && (
            <li className="nav-item">
              <Link className="nav-link" to="/admin">Admin Dashboard</Link>
            </li>
          )}
        </ul>
        <ul className="navbar-nav ms-auto">
          {user ? (
            <>
              <li className="nav-item">
                <span className="nav-link text-light">Hi, {user.name}</span>
              </li>
              <li className="nav-item">
                <button className="btn btn-outline-light btn-sm ms-2" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li className="nav-item">
                <Link className="nav-link" to="/login">Login</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/register">Register</Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}
