import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Bus, 
  ArrowLeft, 
  CalendarDays,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ChevronLeft
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export default function DashboardView({ onNavigateToReports, onNavigateToFollowUp, onNavigateToFleet }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Quick schedule next treatment form
  const [scheduleBus, setScheduleBus] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleSetNextTreatment = async (e) => {
    e.preventDefault();
    if (!scheduleBus.trim() || !scheduleDate) {
      setScheduleError('נא להזין מספר אוטובוס ותאריך');
      return;
    }

    setScheduling(true);
    setScheduleError('');
    setScheduleSuccess('');

    try {
      const res = await fetch('/api/buses/next-treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busNumber: scheduleBus.trim(),
          nextTreatmentDate: scheduleDate
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'שגיאה בקביעת מועד טיפול');
      }

      setScheduleSuccess(`מועד הטיפול הבא לאוטובוס ${scheduleBus} נקבע בהצלחה (${resData.status})!`);
      setScheduleBus('');
      setScheduleDate('');
      loadDashboard();
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    treatmentsToday: 0,
    treatmentNeeded: 0,
    followUpQueue: 0,
    overdue: 0,
    uniqueUrgent: 0
  };

  const totalUrgent = metrics.uniqueUrgent !== undefined 
    ? metrics.uniqueUrgent 
    : ((metrics.treatmentNeeded || 0) + (metrics.overdue || 0));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">לוח בקרה ניהולי</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
            תמונת מצב שוטפת של ביצועי הטיפול המונע, חלוקת מפעילים ומשימות הדורשות טיפול
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadDashboard}
            className="p-2.5 px-3.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold min-h-[44px]"
            title="רענן נתוני לוח בקרה"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>רענן נתונים</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Action Section: Actionable Urgent Cards (Prominent & High-Contrast) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <h2 className="text-sm font-black text-slate-900">אוטובוסים הדורשים טיפול או התערבות מיידית</h2>
          </div>
          {onNavigateToFleet && (
            <button
              onClick={() => onNavigateToFleet('')}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
            >
              <span>לצי הרכבים המלא</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 3 Actionable Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          {/* Card A: Treatment Needed */}
          <div 
            onClick={() => onNavigateToFleet ? onNavigateToFleet('pending') : onNavigateToReports()}
            className="bg-amber-50/90 border-2 border-amber-400/80 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-amber-500 cursor-pointer transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                נדרש טיפול מונע
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-amber-950">{metrics.treatmentNeeded || 0}</div>
            <p className="text-xs text-amber-900 mt-1 font-bold leading-relaxed">
              ללא טיפול תקף או שהגיע מועד הטיפול
            </p>
          </div>

          {/* Card B: Overdue */}
          <div 
            onClick={() => onNavigateToFleet ? onNavigateToFleet('overdue') : onNavigateToReports()}
            className="bg-rose-50/90 border-2 border-rose-400/80 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-rose-500 cursor-pointer transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-rose-900 bg-rose-100 px-2 py-0.5 rounded-md">
                באיחור (מעל 6 חודשים)
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-200 text-rose-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-rose-950">{metrics.overdue || 0}</div>
            <p className="text-xs text-rose-900 mt-1 font-bold leading-relaxed">
              מועד הטיפול המונע פג תוקף
            </p>
          </div>

          {/* Card C: Follow Up Queue */}
          <div 
            onClick={onNavigateToFollowUp}
            className="bg-purple-50/90 border-2 border-purple-400/80 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-purple-500 cursor-pointer transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-purple-900 bg-purple-100 px-2 py-0.5 rounded-md">
                תור המשך טיפול לקוח
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-200 text-purple-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-purple-950">{metrics.followUpQueue || 0}</div>
            <p className="text-xs text-purple-900 mt-1 font-bold leading-relaxed flex items-center justify-between">
              <span>ממתינים לתיקון מוסך / לקוח</span>
              <span className="text-purple-700 underline font-black">פתח תור ➔</span>
            </p>
          </div>

        </div>

        {/* Action CTA Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-3.5 px-5 flex items-center justify-between flex-wrap gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚡</span>
            <div>
              <span className="text-xs font-black text-white block">
                {totalUrgent > 0 ? `קיימים ${totalUrgent} אוטובוסים הדורשים תשומת לב או טיפול` : 'כל האוטובוסים בצי מעודכנים ובתוקף!'}
              </span>
              <span className="text-[11px] text-slate-300 font-medium">
                לחץ למעבר ישיר לאיתור האוטובוסים והתחלת טיפול
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigateToFleet ? onNavigateToFleet('pending') : onNavigateToReports()}
            className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-sm inline-flex items-center gap-2 transition-all min-h-[40px]"
          >
            <span>צפה באוטובוסים הדורשים טיפול</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Informational Overview Cards (Calm & Balanced) */}
      <div className="space-y-3">
        <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <Bus className="w-4 h-4 text-emerald-600" />
          <span>מעקב התקדמות לפי מפעיל וסטטוס סגירה</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Total Reports */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-600">סה"כ דוחות שבוצעו</span>
              <ShieldCheck className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">{metrics.totalReports || metrics.totalCompleted || 0}</div>
            <span className="text-xs text-emerald-700 font-bold mt-0.5 block">
              {metrics.totalCompleted || 0} הושלמו בהצלחה
            </span>
          </div>

          {/* Dan BaDarom */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">דן בדרום</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded">
                  דרום
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {metrics.completedDanBaDarom || 0}
                {metrics.totalDanBaDarom && (
                  <span className="text-xs font-bold text-slate-500 mr-1.5">
                    מתוך {metrics.totalDanBaDarom}
                  </span>
                )}
              </div>
              <span className="text-xs text-blue-800 font-bold mt-0.5 block">
                {metrics.totalDanBaDarom 
                  ? `${Math.round(((metrics.completedDanBaDarom || 0) / metrics.totalDanBaDarom) * 100)}% הושלמו`
                  : 'טיפולים בתוקף'}
              </span>
            </div>
            {Boolean(metrics.totalDanBaDarom) && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.round(((metrics.completedDanBaDarom || 0) / metrics.totalDanBaDarom) * 100))}%` }}
                />
              </div>
            )}
          </div>

          {/* Dan Beer Sheva */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">דן באר שבע</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded">
                  באר שבע
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {metrics.completedDanBeerSheva || 0}
                {metrics.totalDanBeerSheva && (
                  <span className="text-xs font-bold text-slate-500 mr-1.5">
                    מתוך {metrics.totalDanBeerSheva}
                  </span>
                )}
              </div>
              <span className="text-xs text-emerald-800 font-bold mt-0.5 block">
                {metrics.totalDanBeerSheva 
                  ? `${Math.round(((metrics.completedDanBeerSheva || 0) / metrics.totalDanBeerSheva) * 100)}% הושלמו`
                  : 'טיפולים בתוקף'}
              </span>
            </div>
            {Boolean(metrics.totalDanBeerSheva) && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.round(((metrics.completedDanBeerSheva || 0) / metrics.totalDanBeerSheva) * 100))}%` }}
                />
              </div>
            )}
          </div>

          {/* Closed in EDI */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-700">סגור באדי (EDI)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{metrics.ediClosed || 0}</div>
            <span className="text-xs text-slate-500 font-medium mt-0.5 block">
              דוחות שנסגרו בהתחשבנות
            </span>
          </div>

          {/* Open in EDI */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-700">פתוח באדי</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700">{metrics.ediOpen || 0}</div>
            <span className="text-xs text-slate-500 font-medium mt-0.5 block">
              ממתינים לסגירה באדי
            </span>
          </div>

        </div>
      </div>

      {/* 4. Bottom Grid: Quick Scheduling Form & Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Action: Schedule Next Treatment Date */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
              <span>קביעת מועד טיפול הבא</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              הזן מספר אוטובוס ותאריך יעד. תאריך עתידי מעדכן את הסטטוס ל'טיפול בתוקף'.
            </p>
          </div>

          {scheduleSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-black text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{scheduleSuccess}</span>
            </div>
          )}

          {scheduleError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-black text-rose-800">
              ⚠️ {scheduleError}
            </div>
          )}

          <form onSubmit={handleSetNextTreatment} className="space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1">מספר אוטובוס (לוחית רישוי)</label>
              <input
                type="text"
                dir="ltr"
                placeholder="לדוגמה: 17759703"
                value={scheduleBus}
                onChange={(e) => setScheduleBus(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1">תאריך טיפול הבא</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={scheduling}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
            >
              {scheduling ? 'מעדכן...' : 'עדכן מועד טיפול הבא'}
            </button>
          </form>
        </div>

        {/* Recent Reports List */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Bus className="w-5 h-5 text-emerald-600" />
              <span>דוחות טיפול אחרונים שבוצעו</span>
            </h2>
            <button
              onClick={onNavigateToReports}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 min-h-[36px]"
            >
              <span>לכל הדוחות</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {(!data?.recentReports || data.recentReports.length === 0) ? (
            <div className="text-center py-10 text-slate-500 text-sm font-bold">
              טרם בוצעו טיפולים במערכת
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">מפעיל</th>
                    <th className="p-3">מספר אוטובוס</th>
                    <th className="p-3">טכנאי</th>
                    <th className="p-3">תוצאה</th>
                    <th className="p-3">תאריך</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentReports.map(report => (
                    <tr key={report.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-700">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          report.operator === 'דן בדרום' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {report.operator || 'דן באר שבע'}
                        </span>
                      </td>
                      <td className="p-3 font-black text-slate-900 font-mono text-sm" dir="ltr">{report.bus_number}</td>
                      <td className="p-3 text-slate-700 font-medium">{report.technician_name}</td>
                      <td className="p-3">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {new Date(report.created_at).toLocaleDateString('he-IL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
