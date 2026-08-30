import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Bus, RefreshCw, Eye, Check } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

export default function FollowUpQueueView({ onViewReport }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingBus, setResolvingBus] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/follow-up-queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (err) {
      console.error('Failed to load follow-up queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleResolve = async (busNumber) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/resolve-follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busNumber, resolutionNotes })
      });
      if (res.ok) {
        setResolvingBus(null);
        setResolutionNotes('');
        loadQueue();
      }
    } catch (err) {
      console.error('Failed to resolve follow up:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </span>
            <span>תור המשך טיפול</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            אוטובוסים שהטכנאי סימן כדורשים המשך טיפול של הלקוח / הגורם המטפל
          </p>
        </div>

        <button
          onClick={loadQueue}
          className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">רענן</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">אין אוטובוסים הממתינים להמשך טיפול</h2>
          <p className="text-xs text-slate-500">כל הטיפולים הושלמו כהלכה ואין חריגות פתוחות בתור</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.map((item) => (
            <div key={item.bus_number} className="bg-white rounded-2xl border border-rose-200 shadow-sm p-5 space-y-4 flex flex-col justify-between">
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bus className="w-5 h-5 text-rose-600" />
                    <span className="text-lg font-black text-slate-900">{item.bus_number}</span>
                  </div>
                  <StatusBadge status="הועבר להמשך טיפול" />
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                  <div><strong>טכנאי מדווח:</strong> {item.technician_name}</div>
                  <div><strong>מועד דוח:</strong> {new Date(item.treatment_date).toLocaleString('he-IL')}</div>
                  <div className="pt-1">
                    <strong className="block text-rose-800">סיכום התקלה / הטיפול:</strong>
                    <p className="text-slate-800 line-clamp-3 mt-0.5">{item.summary}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onViewReport(item.report_id)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>צפה בדוח</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResolvingBus(item.bus_number)}
                  className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>סגור טיפול</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Modal to resolve follow-up */}
      {resolvingBus && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              סגירת המשך טיפול לאוטובוס {resolvingBus}
            </h3>
            <p className="text-xs text-slate-500">
              פעולה זו תסמן את האוטובוס כ"הטיפול הושלם" ותסיר אותו מתור המשך הטיפול.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                הערות סגירה (אופציונלי):
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="פרט איזה תיקון בוצע ע״י הלקוח..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingBus(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleResolve(resolvingBus)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {actionLoading ? 'מעדכן...' : 'אשר סגירה'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
