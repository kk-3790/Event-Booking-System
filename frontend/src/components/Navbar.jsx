import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sparkles, Ticket, Calendar, Shield, LogOut, User as UserIcon, Sun, Moon } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const roleBadgeStyles = {
    ADMIN: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    ORGANIZER: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    CUSTOMER: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };

  return (
    <nav className="glass-nav border-b border-slate-800/80 sticky top-0 z-40 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo & Main Nav */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Event<span className="text-indigo-400">Hub</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-5 text-sm font-medium">
            <Link
              to="/"
              className={`transition-colors py-1 ${
                isActive('/') ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Browse Events
            </Link>

            {user?.role === 'CUSTOMER' && (
              <Link
                to="/my-bookings"
                className={`flex items-center gap-1.5 transition-colors py-1 ${
                  isActive('/my-bookings') ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Ticket className="w-4 h-4 text-emerald-400" />
                <span>My Bookings</span>
              </Link>
            )}

            {user?.role === 'ORGANIZER' && (
              <Link
                to="/organizer/events"
                className={`flex items-center gap-1.5 transition-colors py-1 ${
                  isActive('/organizer/events') ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Organizer Studio</span>
              </Link>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 transition-colors py-1 ${
                  isActive('/admin') ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Admin Dashboard</span>
              </Link>
            )}
          </div>
        </div>

        {/* Right User State */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500 hover:-rotate-12 transition-transform" />
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2.5 sm:gap-3">
              
              {/* Notification Center Bell */}
              <NotificationCenter />

              {/* Role Badge */}
              <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadgeStyles[user.role] || roleBadgeStyles.CUSTOMER}`}>
                {user.role}
              </span>

              {/* User Avatar */}
              <div className="flex items-center gap-2.5 py-1 px-2 rounded-full bg-slate-900/80 border border-slate-800">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                </div>
                <span className="text-xs font-semibold text-slate-200 max-w-[120px] truncate hidden md:inline">
                  {user.name}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}
