import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, ArrowLeft, Home, Calendar, Shield, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Smart role-based home destination
  const getHomeDestination = () => {
    if (user?.role === 'ORGANIZER') {
      return { path: '/organizer/events', label: 'Go to Organizer Studio', icon: Calendar };
    }
    if (user?.role === 'ADMIN') {
      return { path: '/admin', label: 'Go to Admin Dashboard', icon: Shield };
    }
    return { path: '/', label: 'Browse Public Events', icon: Home };
  };

  const home = getHomeDestination();
  const HomeIcon = home.icon;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center space-y-8 p-8 md:p-10 rounded-3xl bg-slate-900/70 border border-slate-800 glass-card shadow-2xl relative overflow-hidden">
        
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* 404 Badge & Icon */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold tracking-wider uppercase">
            <Compass className="w-3.5 h-3.5 text-indigo-400 animate-spin-slow" />
            <span>HTTP 404 · Resource Not Found</span>
          </div>

          <h1 className="text-7xl md:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-indigo-400">
            404
          </h1>

          <h2 className="text-xl md:text-2xl font-extrabold text-white">
            Page Not Available
          </h2>

          <p className="text-slate-400 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
            The requested address{' '}
            <code className="text-indigo-300 font-mono bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-xs">
              {location.pathname}
            </code>{' '}
            does not exist on EventHub or has been relocated.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to={home.path} className="w-full sm:w-auto">
            <Button variant="gradient" size="md" className="w-full sm:w-auto shadow-xl shadow-indigo-600/25">
              <HomeIcon className="w-4 h-4 mr-2" />
              <span>{home.label}</span>
            </Button>
          </Link>

          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span>Go Back</span>
          </Button>
        </div>

        {/* Footer tip */}
        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Double check the typed URL or explore platform listings.</span>
        </div>

      </div>
    </div>
  );
}
