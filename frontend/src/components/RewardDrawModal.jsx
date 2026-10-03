import { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Gift, 
  Users, 
  Trophy, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Percent, 
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import * as rewardService from '../services/rewardService';
import Button from './ui/Button';

export default function RewardDrawModal({ isOpen, onClose, event }) {
  if (!isOpen || !event) return null;

  const [drawData, setDrawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Form inputs
  const [discountPercentage, setDiscountPercentage] = useState(20);
  const [numberOfWinners, setNumberOfWinners] = useState(2);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  const fetchDraw = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await rewardService.getEventDraw(event._id);
      if (data.draw) {
        setDrawData(data.draw);
        setDiscountPercentage(data.draw.discountPercentage || 20);
        setNumberOfWinners(data.draw.numberOfWinners || 2);
      } else {
        setDrawData(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch draw details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraw();
  }, [event._id]);

  const isCancelled = event.status === 'CANCELLED' || event.status === 'DELETED';
  const isPastEndTime = () => {
    if (!event.date) return false;
    try {
      const d = new Date(event.date);
      const [h, m] = (event.endTime || event.time || '23:59').split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
      return new Date() > d;
    } catch {
      return false;
    }
  };
  const isEventCompleted = event.status === 'COMPLETED' || (!isCancelled && isPastEndTime());
  const isCompleted = drawData?.drawStatus === 'COMPLETED';

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (isEventCompleted) {
      setError('Campaign settings cannot be modified because this event has concluded.');
      return;
    }
    setSaving(true);
    setError('');
    setActionSuccess('');
    try {
      const { data } = await rewardService.createOrUpdateDraw(event._id, {
        discountPercentage: Number(discountPercentage),
        numberOfWinners: Number(numberOfWinners),
      });
      setDrawData(data.draw);
      setActionSuccess('Promotional lucky reward settings saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update reward settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunDraw = async () => {
    if (!drawData) return;
    if (isCompleted) {
      setError('The lucky draw for this event has already been conducted. Re-drawing is disabled.');
      return;
    }
    setExecuting(true);
    setError('');
    setActionSuccess('');
    try {
      const { data } = await rewardService.executeDraw(drawData._id);
      setDrawData(data.draw);
      setActionSuccess(`Lucky Draw complete! ${data.winners?.length || 0} winners have been chosen and notified.`);
      fetchDraw();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to execute draw. Check participant requirements.');
    } finally {
      setExecuting(false);
    }
  };

  const promoPrice = Math.round((event.ticketPrice || 0) * (1 - discountPercentage / 100));
  const participantsCount = drawData?.participants?.length || 0;
  const winnersCount = drawData?.winners?.length || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden glass-card my-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isCompleted ? 'Lucky Draw Winners Checklist' : 'Lucky Discount & Reward Draw'}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{event.eventName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          
          {actionSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isEventCompleted && (
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Event Concluded:</strong> {isCompleted ? 'Lucky draw has been concluded. Viewing official winners checklist.' : 'Campaign settings are locked. You can now execute the lucky draw for your attendees.'}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 shrink-0">
                {isCompleted ? 'Draw Closed' : 'Draw Ready'}
              </span>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Status</span>
              <span className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${
                isCompleted 
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                  : isEventCompleted
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : drawData ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
              }`}>
                {isCompleted ? 'DRAW CONCLUDED' : isEventCompleted ? 'READY TO EXECUTE' : (drawData?.drawStatus || 'NOT CONFIGURED')}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Participants</span>
              <span className="text-base font-black text-white mt-0.5 block">{participantsCount}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Winners Picked</span>
              <span className="text-base font-black text-amber-400 mt-0.5 block">{winnersCount}</span>
            </div>
          </div>

          {/* Configuration Form */}
          <form onSubmit={handleSaveConfig} className="space-y-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Campaign Settings</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Discount (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    disabled={isCompleted || isEventCompleted}
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                </div>
                <span className="text-[10px] text-slate-500">
                  Promo Seat Price: <strong className="text-indigo-400">₹{promoPrice}</strong> (was ₹{event.ticketPrice})
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Winners to Pick</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={isCompleted || isEventCompleted}
                    value={numberOfWinners}
                    onChange={(e) => setNumberOfWinners(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <Trophy className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                </div>
                <span className="text-[10px] text-slate-500">Randomly selected upon execution</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              {isEventCompleted ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/40 text-slate-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Campaign Locked (Event Concluded)</span>
                </div>
              ) : isCompleted ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Campaign Finalized & Settings Locked</span>
                </div>
              ) : (
                <Button variant="secondary" size="sm" loading={saving} type="submit">
                  <span>Save Reward Campaign</span>
                </Button>
              )}
            </div>
          </form>

          {/* Execution Section */}
          {drawData && (
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isCompleted 
                ? 'bg-purple-500/10 border-purple-500/30' 
                : 'bg-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className={`text-xs font-bold flex items-center gap-1.5 ${isCompleted ? 'text-purple-300' : 'text-amber-300'}`}>
                    <Trophy className="w-4 h-4 shrink-0" />
                    <span>{isCompleted ? 'Official Winners Checklist' : 'Conduct Random Winner Draw'}</span>
                  </h5>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {isCompleted
                      ? `Event concluded. Below is the verified checklist of ${winnersCount} lucky winners and their next-booking discount vouchers.`
                      : isEventCompleted
                      ? `Event concluded: Execute the lucky draw to pick ${numberOfWinners} lucky winners from ${participantsCount} enrolled ticket buyers.`
                      : `Picks ${numberOfWinners} lucky winners from ${participantsCount} enrolled ticket buyers and sends in-app notifications.`}
                  </p>
                </div>

                {isCompleted ? (
                  <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-500/40 text-xs font-bold shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Official Draw Closed</span>
                  </div>
                ) : (
                  <Button
                    variant="gradient"
                    size="sm"
                    loading={executing}
                    onClick={handleRunDraw}
                    disabled={participantsCount === 0}
                    className="shrink-0 cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5 mr-1.5" />
                    <span>Execute Draw</span>
                  </Button>
                )}
              </div>

              {/* Winners List */}
              {drawData.winners && drawData.winners.length > 0 && (
                <div className="pt-3 border-t border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                      Announced Lucky Winners:
                    </span>
                    <span className="text-[10px] text-amber-300/80">
                      Issued {drawData.discountPercentage}% Discount for next booking with you
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {drawData.winners.map((winner, idx) => {
                      const winnerId = (winner._id || winner).toString();
                      const voucher = drawData.vouchers?.find(
                        (v) => (v.user?._id || v.user)?.toString() === winnerId
                      );

                      return (
                        <div
                          key={winner._id || idx}
                          className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-white block truncate">{winner.name || 'Lucky Attendee'}</span>
                              <span className="text-[10px] text-slate-400 block truncate">{winner.email}</span>
                            </div>
                          </div>

                          {voucher && (
                            <div className="flex items-center gap-1.5 shrink-0 pl-8 sm:pl-0">
                              <span className="text-[10px] text-slate-400">Voucher:</span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
                                {voucher.code}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                ({voucher.discountPercentage}% OFF)
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!drawData && isEventCompleted && (
            <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 text-center space-y-2">
              <Trophy className="w-8 h-8 text-slate-500 mx-auto" />
              <h5 className="text-xs font-bold text-slate-300">No Lucky Draw Configured</h5>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                This event has already completed. Lucky draws can only be configured and conducted while an event is active or ongoing.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
