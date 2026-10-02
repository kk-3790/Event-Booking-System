import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Sparkles, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  // Default organizer credentials
  const [form, setForm] = useState({
    email: 'organizer@eventhub.com',
    password: 'organizer123',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Restore remembered email on initial load if previously saved
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setForm((prev) => ({ ...prev, email: savedEmail, password: '' }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Handle Remember Me persistence
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', form.email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      const user = await login(form);
      if (user?.role === 'ADMIN') {
        navigate('/admin');
      } else if (user?.role === 'ORGANIZER') {
        navigate('/organizer/events');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="relative min-h-[calc(100vh-73px)] flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-transparent rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md space-y-8">
        
        {/* Header Branding */}
        <div className="text-center space-y-2.5">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Event<span className="text-indigo-400">Hub</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white pt-2">Welcome Back</h1>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Sign in to access your booked passes, manage events, or discover new experiences
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-7 md:p-8 shadow-2xl glass-card backdrop-blur-xl space-y-6">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              name="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={handleChange}
              icon={Mail}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="••••••••••••"
              value={form.password}
              onChange={handleChange}
              icon={Lock}
              required
              autoComplete="current-password"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 select-none">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer accent-indigo-600"
                />
                <span>Remember me</span>
              </label>
              <a href="#" onClick={(e) => { e.preventDefault(); alert('Please contact administrator to reset password.'); }} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              loading={loading}
              className="w-full mt-2 cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          <div className="pt-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-2 text-center">
              Quick Demo Autofill
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setForm({ email: 'organizer@eventhub.com', password: 'organizer123' })}
                className="px-2 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition cursor-pointer text-center"
                title="organizer@eventhub.com / organizer123"
              >
                🏢 Organizer
              </button>
              <button
                type="button"
                onClick={() => setForm({ email: 'admin@eventhub.com', password: 'admin123' })}
                className="px-2 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition cursor-pointer text-center"
                title="admin@eventhub.com / admin123"
              >
                🛡️ Admin
              </button>
              <button
                type="button"
                onClick={() => setForm({ email: 'customer@eventhub.com', password: 'customer123' })}
                className="px-2 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition cursor-pointer text-center"
                title="customer@eventhub.com / customer123"
              >
                🎟️ Customer
              </button>
            </div>
            <div className="flex justify-center gap-2 pt-1 text-[11px] text-slate-400">
              <span>Or:</span>
              <button
                type="button"
                onClick={() => setForm({ email: 'krish@test.com', password: 'Password@123' })}
                className="underline hover:text-indigo-400 transition cursor-pointer"
              >
                krish@test.com / Password@123
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900/90 px-3 text-slate-500 uppercase tracking-wider text-[10px]">
                New to EventHub?
              </span>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all duration-150"
            >
              Create a free account
            </Link>
          </div>

        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>256-bit encrypted authentication</span>
        </div>

      </div>
    </div>
  );
}
