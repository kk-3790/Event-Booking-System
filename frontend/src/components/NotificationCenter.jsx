import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as notificationService from '../services/notificationService';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  Info, 
  X, 
  Ticket,
  Check
} from 'lucide-react';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationService.getMyNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.length);
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for background notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleMarkAllRead = () => {
    setUnreadCount(0);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'BOOKING_CONFIRMATION':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'EVENT_REMINDER':
        return <Clock className="w-4 h-4 text-indigo-400" />;
      case 'DRAW_RESULT':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'PAYMENT_FAILED':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer focus:outline-none"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notification Drawer Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden glass-card z-50 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-medium text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-400">No new notifications right now.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const formattedTime = n.createdAt
                  ? new Date(n.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Recent';

                return (
                  <div key={n._id} className="p-4 hover:bg-slate-800/30 transition-colors space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="text-xs text-slate-200 leading-snug">
                          {n.message}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span className="font-medium text-slate-400">
                            {n.type.replace('_', ' ')}
                          </span>
                          <span>{formattedTime}</span>
                        </div>
                      </div>
                    </div>

                    {n.booking && (
                      <div className="pl-11">
                        <Link
                          to="/my-bookings"
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                        >
                          <Ticket className="w-3 h-3" />
                          <span>View Ticket in Wallet →</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 text-center">
            <Link
              to="/my-bookings"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Go to Ticket Wallet →
            </Link>
          </div>

        </div>
      )}
    </div>
  );
}
