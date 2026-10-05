import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  QrCode, 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  Ticket, 
  ShieldCheck, 
  Search, 
  Sparkles,
  RotateCcw,
  Volume2,
  VolumeX,
  Users,
  SwitchCamera,
  Loader2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import * as bookingService from '../services/bookingService';
import Button from './ui/Button';

// Web Audio API chime generator for gate feedback
const playAudioFeedback = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Upbeat happy dual chime (880Hz -> 1320Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'duplicate') {
      // Amber alert double warble (440Hz -> 330Hz)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Low error buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    // AudioContext blocked or not supported
  }
};

export default function CheckInScannerModal({ isOpen, onClose, event, onCheckInComplete }) {
  if (!isOpen || !event) return null;

  const [ticketInput, setTicketInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stats, setStats] = useState({ totalConfirmed: 0, checkedIn: 0 });
  const [recentCheckIns, setRecentCheckIns] = useState([]);
  
  const scannerRef = useRef(null);
  const scannerContainerId = 'gate-qr-reader-container';
  const isProcessingScanRef = useRef(false);
  const lastScannedCodeRef = useRef('');
  const lastScanTimeRef = useRef(0);

  // Load initial check-in stats
  const fetchStats = async () => {
    try {
      const { data } = await bookingService.getEventAttendees(event._id);
      if (data.stats) {
        setStats({
          totalConfirmed: data.stats.totalConfirmedSeats || 0,
          checkedIn: data.stats.totalCheckedInSeats || 0,
        });
      }
    } catch (err) {
      // Silent stats error
    }
  };

  useEffect(() => {
    fetchStats();
  }, [event._id]);

  // Enumerate cameras on modal mount so user sees available hardware
  useEffect(() => {
    let isMounted = true;
    const probeCameras = async () => {
      try {
        if (navigator?.mediaDevices?.enumerateDevices) {
          const devices = await Html5Qrcode.getCameras();
          if (isMounted && devices && devices.length > 0) {
            setAvailableCameras(devices);
            // Default to back/rear camera if present, otherwise first available
            const rearCamera = devices.find((c) => /back|rear|environment|macro/i.test(c.label));
            setSelectedCameraId(rearCamera ? rearCamera.id : devices[0].id);
          }
        }
      } catch (err) {
        console.warn('Probe cameras warning:', err.message);
      }
    };
    probeCameras();
    return () => {
      isMounted = false;
      stopCameraScanner();
    };
  }, []);

  const startCameraScanner = async (specificCameraId = null) => {
    setCameraLoading(true);
    setCameraError('');

    // Check mediaDevices support and secure context
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        window.isSecureContext === false
          ? 'Camera requires a secure connection (HTTPS or localhost). Please open this app via HTTPS or localhost.'
          : 'Your browser does not support camera access. Please use a modern browser (Chrome, Safari, or Edge).'
      );
      setCameraLoading(false);
      setCameraActive(false);
      return;
    }

    // Stop and clear any existing instance first
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }

    try {
      // 1. Enumerate available video cameras
      let cameras = [];
      try {
        cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
        }
      } catch (e) {
        console.warn('Could not enumerate cameras prior to start:', e.message);
      }

      // 2. Instantiate Html5Qrcode with container ID
      scannerRef.current = new Html5Qrcode(scannerContainerId);

      // 3. Determine camera source config
      const targetId = specificCameraId || selectedCameraId;
      let cameraConfig = null;

      if (targetId && cameras.some((c) => c.id === targetId)) {
        cameraConfig = targetId;
      } else if (cameras && cameras.length > 0) {
        const rearCamera = cameras.find((c) => /back|rear|environment|macro/i.test(c.label));
        const chosen = rearCamera || cameras[0];
        cameraConfig = chosen.id;
        setSelectedCameraId(chosen.id);
      }

      const scanConfig = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(160, Math.floor(edge * 0.72));
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      const onScanSuccess = (decodedText) => {
        const now = Date.now();
        if (isProcessingScanRef.current) return;
        if (decodedText === lastScannedCodeRef.current && now - lastScanTimeRef.current < 2500) {
          return;
        }
        isProcessingScanRef.current = true;
        lastScannedCodeRef.current = decodedText;
        lastScanTimeRef.current = now;

        handleVerifyTicket(decodedText).finally(() => {
          setTimeout(() => {
            isProcessingScanRef.current = false;
          }, 800);
        });
      };

      const onScanError = () => {
        // ignore frame parse error
      };

      // Try starting with target camera device ID
      if (cameraConfig) {
        try {
          await scannerRef.current.start(cameraConfig, scanConfig, onScanSuccess, onScanError);
          setCameraActive(true);
          setCameraLoading(false);
          return;
        } catch (errDev) {
          console.warn('Specific camera start failed, attempting facingMode fallbacks:', errDev.message);
        }
      }

      // Fallback A: Try { facingMode: 'environment' } (mobile rear camera)
      try {
        await scannerRef.current.start({ facingMode: 'environment' }, scanConfig, onScanSuccess, onScanError);
        setCameraActive(true);
        setCameraLoading(false);
        return;
      } catch (errEnv) {
        console.warn('Environment facingMode failed, trying user camera fallback:', errEnv.message);
      }

      // Fallback B: Try { facingMode: 'user' } (FaceTime / Laptop webcam on macOS/Windows)
      await scannerRef.current.start({ facingMode: 'user' }, scanConfig, onScanSuccess, onScanError);
      setCameraActive(true);
      setCameraLoading(false);

    } catch (err) {
      console.error('Camera scanner startup error:', err);
      let message = 'Could not access device camera. Please check camera permissions.';
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission') || err.message?.includes('denied')) {
        message = 'Camera permission was denied. Please allow camera access in your browser address bar settings and click Start Scanner again.';
      } else if (err.name === 'NotFoundError' || err.message?.includes('device not found')) {
        message = 'No camera found on this device. Please connect a webcam or use manual reference lookup.';
      } else if (err.name === 'NotReadableError' || err.message?.includes('Could not start video source')) {
        message = 'Camera is in use by another application (e.g., Zoom, FaceTime). Please close other apps and try again.';
      } else if (err.message) {
        message = err.message;
      }
      setCameraError(message);
      setCameraActive(false);
      setCameraLoading(false);
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  };

  const toggleCamera = () => {
    if (cameraActive) {
      stopCameraScanner();
    } else {
      startCameraScanner();
    }
  };

  const handleSwitchCamera = async (newCameraId) => {
    setSelectedCameraId(newCameraId);
    if (cameraActive) {
      await stopCameraScanner();
      await startCameraScanner(newCameraId);
    }
  };

  const handleVerifyTicket = async (codeToVerify) => {
    const code = (codeToVerify || ticketInput).trim();
    if (!code || loading) return;

    setLoading(true);
    setScanResult(null);

    try {
      const { data } = await bookingService.checkInAttendee({
        ticketRef: code,
        eventId: event._id,
      });

      if (soundEnabled) playAudioFeedback('success');

      const result = {
        type: 'success',
        message: data.message,
        attendee: data.attendee,
        booking: data.booking,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      };
      setScanResult(result);
      setTicketInput('');
      setRecentCheckIns((prev) => [result, ...prev.slice(0, 9)]);
      fetchStats();
      if (onCheckInComplete) onCheckInComplete();
    } catch (err) {
      const errData = err.response?.data || {};
      if (err.response?.status === 409) {
        if (soundEnabled) playAudioFeedback('duplicate');
        setScanResult({
          type: 'duplicate',
          message: errData.message || 'Attendee already checked in!',
          attendee: errData.attendee,
          booking: errData.booking,
          checkedInAt: errData.checkedInAt,
        });
      } else {
        if (soundEnabled) playAudioFeedback('error');
        setScanResult({
          type: 'error',
          message: errData.message || 'Ticket verification failed. Pass not recognized.',
          attendee: errData.attendee,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleVerifyTicket();
  };

  const percentCheckedIn = stats.totalConfirmed > 0 
    ? Math.round((stats.checkedIn / stats.totalConfirmed) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden glass-card my-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Gate Admission Scanner</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-bold uppercase tracking-wider">
                  Live Check-in
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-sm mt-0.5">
                {event.eventName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={() => {
                stopCameraScanner();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Gate Counter Bar */}
        <div className="px-6 py-3.5 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-mono">Admitted Passes</span>
              <span className="font-extrabold text-white text-sm">
                {stats.checkedIn} <span className="text-slate-500 font-normal">/ {stats.totalConfirmed}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-mono">Turnout Rate</span>
              <span className="font-extrabold text-indigo-400 text-sm">{percentCheckedIn}%</span>
            </div>
          </div>

          <div className="w-full sm:w-48 bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, percentCheckedIn)}%` }}
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Camera Scanner Viewport */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                Live Camera QR Scanner
              </span>

              <div className="flex items-center gap-2">
                {/* Camera Selector (if multiple cameras available) */}
                {availableCameras.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                    <SwitchCamera className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <select
                      value={selectedCameraId}
                      onChange={(e) => handleSwitchCamera(e.target.value)}
                      disabled={cameraLoading}
                      className="bg-transparent text-white text-[11px] font-medium focus:outline-none cursor-pointer max-w-[140px] truncate"
                      title="Select Camera"
                    >
                      {availableCameras.map((cam, idx) => (
                        <option key={cam.id} value={cam.id} className="bg-slate-900 text-white">
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  variant={cameraActive ? 'destructive' : 'gradient'}
                  size="sm"
                  onClick={toggleCamera}
                  loading={cameraLoading}
                  disabled={cameraLoading}
                  className="cursor-pointer"
                >
                  {cameraActive ? (
                    <>
                      <CameraOff className="w-3.5 h-3.5 mr-1" />
                      <span>Stop Camera</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      <span>Start Scanner</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Viewport Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden relative min-h-[260px] flex flex-col justify-center">
              {/* Dedicated mounting container for Html5Qrcode - NEVER place React children inside this */}
              <div 
                id={scannerContainerId} 
                className={`w-full overflow-hidden ${cameraActive ? 'block' : 'hidden'}`}
              />

              {/* Idle placeholder shown when camera is off */}
              {!cameraActive && (
                <div className="py-10 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                    <Camera className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <p className="text-sm font-semibold text-white">Camera is currently idle</p>
                    <p className="text-xs text-slate-400">
                      Click <span className="text-indigo-400 font-semibold">Start Scanner</span> to enable camera gate admission.
                    </p>
                  </div>
                  {availableCameras.length > 0 && (
                    <p className="text-[11px] text-slate-500 font-mono">
                      {availableCameras.length} camera device{availableCameras.length > 1 ? 's' : ''} detected on this system
                    </p>
                  )}
                </div>
              )}
            </div>

            {cameraError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-white block">Camera Access Notice</span>
                  <span className="text-[11px] text-rose-300/90 leading-relaxed block">{cameraError}</span>
                  <p className="text-[10px] text-slate-400 pt-0.5">
                    Tip: You can also verify tickets instantly by typing or pasting the Booking ID in the Manual Reference Lookup box below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Manual Code Entry Form */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Manual Reference Lookup
            </span>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                  placeholder="Enter Ticket ID (e.g. #BKG-721BE4)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono uppercase placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <Button
                type="submit"
                variant="gradient"
                size="md"
                loading={loading}
                className="cursor-pointer shrink-0"
              >
                <span>Verify</span>
              </Button>
            </form>
          </div>

          {/* Verification Feedback Banner */}
          {scanResult && (
            <div 
              className={`p-4 rounded-2xl border transition-all animate-in fade-in zoom-in-95 ${
                scanResult.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : scanResult.type === 'duplicate'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-start gap-3">
                {scanResult.type === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {scanResult.type === 'duplicate' && (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                {scanResult.type === 'error' && (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1 text-xs flex-1">
                  <h4 className="font-extrabold text-sm text-white">
                    {scanResult.message}
                  </h4>

                  {scanResult.attendee && (
                    <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-300 border-t border-slate-800/60 mt-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Attendee Name</span>
                        <span className="font-bold text-white block truncate">{scanResult.attendee.name || 'Guest'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Pass Quantity</span>
                        <span className="font-bold text-white block">
                          {scanResult.booking?.ticketCount || 1} Tickets
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Ticket Tier</span>
                        <span className="font-mono text-indigo-400 font-bold block">
                          {scanResult.booking?.tierName || 'General Admission'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recent Gate Activity Log */}
          {recentCheckIns.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Recent Gate Activity (Session Log)
              </span>
              <div className="divide-y divide-slate-800/60 rounded-2xl bg-slate-950/40 border border-slate-800/80 overflow-hidden text-xs max-h-40 overflow-y-auto">
                {recentCheckIns.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div>
                        <span className="font-semibold text-white block">{item.attendee?.name || 'Attendee'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          #BKG-{item.booking?._id?.slice(-6).toUpperCase()} • {item.booking?.tierName || 'Pass'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
