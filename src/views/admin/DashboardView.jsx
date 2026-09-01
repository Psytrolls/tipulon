import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Bus, 
  ArrowLeft, 
  Search, 
  CalendarDays,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

export default function DashboardView({ onNavigateToReports, onNavigateToFollowUp }) {
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
    overdue: 0
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">לוח בקרה ניהולי</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">תמונת מצב בזמן אמת של צי האוטובוסים והטיפולים המונעים</p>
        </div>
        <button
          onClick={loadDashboard}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">רענן נתונים</span>
        </button>
      </div>

      {/* 4 KPI Cards (Matching spec Section 7.1) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Treatments Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">טיפולים היום</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{metrics.treatmentsToday}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">דוחות שנחתמו בתאריך הנוכחי</span>
        </div>

        {/* Card 2: Treatment Needed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">נדרש טיפול</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600">{metrics.treatmentNeeded}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">ללא טיפול תקף או שהמועד הגיע</span>
        </div>

        {/* Card 3: Follow Up Queue */}
        <div 
          onClick={onNavigateToFollowUp}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden cursor-pointer hover:border-rose-300 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700">המשך טיפול</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600">{metrics.followUpQueue}</div>
          <span className="text-[11px] text-rose-500 font-bold mt-1 block">אוטובוסים שהועברו לטיפול נוסף ←</span>
        </div>

        {/* Card 4: Overdue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700">באיחור</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600">{metrics.overdue}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">מועד הטיפול הבא עבר</span>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Action: Schedule Next Treatment Date (Section 7.3) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
              <span>קביעת מועד טיפול הבא</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              הזן מספר אוטובוס ותאריך יעד. אם התאריך עתידי הסטטוס יוגדר 'טיפול בתוקף'.
            </p>
          </div>

          {scheduleSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{scheduleSuccess}</span>
            </div>
          )}

          {scheduleError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              ⚠️ {scheduleError}
            </div>
          )}

          <form onSubmit={handleSetNextTreatment} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">מספר אוטובוס</label>
              <input
                type="text"
                placeholder="לדוגמה: 1234567"
                value={scheduleBus}
                onChange={(e) => setScheduleBus(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">תאריך טיפול הבא</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={scheduling}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
              <span>דוחות טיפול אחרונים</span>
            </h2>
            <button
              onClick={onNavigateToReports}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>לכל הדוחות</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {(!data?.recentReports || data.recentReports.length === 0) ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              טרם בוצעו טיפולים במערכת
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">דוח #</th>
                    <th className="p-3">מספר אוטובוס</th>
                    <th className="p-3">טכנאי</th>
                    <th className="p-3">תוצאה</th>
                    <th className="p-3">תאריך</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentReports.map(report => (
                    <tr key={report.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">#{report.id}</td>
                      <td className="p-3 font-bold text-slate-900">{report.bus_number}</td>
                      <td className="p-3 text-slate-600">{report.technician_name}</td>
                      <td className="p-3">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="p-3 text-slate-500 font-medium">
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
