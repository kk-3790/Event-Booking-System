import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Home, Calendar, Shield, LogOut, Lock } from 'lucide-react';
import Button from '../components/ui/Button';

export default function AccessDenied({ allowedRoles = [] }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Smart role-based home destination
  const getHomeDestination = () => {
    if (user?.role === 'ORGANIZER') {
      return { path: '/organizer/events', label: 'Go to Organizer Studio', icon: Calendar };
    }
    if (user?.role === 'ADMIN') {
      return { path: '/admin', label: 'Go to Admin Dashboard', icon: Shield };
    }
    return { path: '/', label: 'Return to Public Events', icon: Home };
  };

  const home = getHomeDestination();
  const HomeIcon = home.icon;

  const handleSwitchAccount = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center space-y-7 p-8 md:p-10 rounded-3xl bg-slate-900/70 border border-rose-500/30 glass-card shadow-2xl relative overflow-hidden">
        
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* 403 Badge & Icon */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold tracking-wider uppercase">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>HTTP 403 · Access Restricted</span>
          </div>

          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner text-3xl">
            <Lock className="w-10 h-10 text-rose-400 animate-pulse" />
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white">
            Permission Denied
          </h2>

          <p className="text-slate-400 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
            You do not have permission to view or manage this area with your current account privileges.
          </p>
        </div>

        {/* Account Info Box */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Current User:</span>
            <span className="font-semibold text-white truncate max-w-[200px]">
              {user?.name || 'Logged-in User'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Your Active Role:</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-800 text-slate-300 border border-slate-700">
              {user?.role || 'GUEST'}
            </span>
          </div>

          {allowedRoles.length > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
              <span className="text-slate-400">Required Role:</span>
              <span className="font-mono text-rose-400 font-bold">
                {allowedRoles.join(' or ')}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <Link to={home.path} className="w-full sm:w-auto">
            <Button variant="gradient" size="md" className="w-full sm:w-auto shadow-xl shadow-indigo-600/25">
              <HomeIcon className="w-4 h-4 mr-2" />
              <span>{home.label}</span>
            </Button>
          </Link>

          <Button
            variant="secondary"
            size="md"
            onClick={handleSwitchAccount}
            className="w-full sm:w-auto cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>Switch Account</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
