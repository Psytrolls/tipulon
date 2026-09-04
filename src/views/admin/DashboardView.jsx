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
  RefreshCw,
  Download,
  Database,
  HardDrive,
  X
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

  // Backup modal state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const res = await fetch('/api/admin/backups');
      if (res.ok) {
        const json = await res.json();
        setBackups(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (showBackupModal) {
      loadBackups();
    }
  }, [showBackupModal]);

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      setBackupMessage('');
      const res = await fetch('/api/admin/backups/create', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setBackupMessage(`✅ גיבוי נוצר בהצלחה: ${data.filename} (${data.sizeFormatted})`);
        loadBackups();
      } else {
        setBackupMessage(`⚠️ שגיאה: ${data.error}`);
      }
    } catch (e) {
      setBackupMessage('⚠️ שגיאה ביצירת הגיבוי');
    } finally {
      setCreatingBackup(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBackupModal(true)}
            className="py-2 px-3.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-all flex items-center gap-2 text-xs font-black shadow-sm active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>גיבוי מסד נתונים</span>
          </button>

          <button
            type="button"
            onClick={loadDashboard}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">רענן נתונים</span>
          </button>
        </div>
      </div>

      {/* Top Main Section: Real-time Counters - Total, Dan BaDarom, Dan Beer Sheva, EDI Closed & Open */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Bus className="w-4 h-4 text-emerald-600" />
            <span>סיכום ביצועים לפי מפעיל ומצב סגירה באדי (EDI)</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">סנכרון נתונים שוטף</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Total Reports in System */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm border border-slate-700">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-300">סה"כ דוחות שנפתחו</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black">{metrics.totalReports || metrics.totalCompleted || 0}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 block font-medium">
              <span className="text-emerald-400 font-bold">{metrics.totalCompleted || 0} הושלמו</span>
              {Boolean(metrics.followUpQueue) && (
                <span className="text-rose-300 font-bold mr-1"> | {metrics.followUpQueue} המשך טיפול</span>
              )}
            </div>
          </div>

          {/* Dan BaDarom */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-blue-900">דן בדרום</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-200 text-blue-900 rounded">
                  {metrics.totalDanBaDarom ? `${metrics.totalDanBaDarom} אוטובוסים` : 'מפעיל'}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-800">
                {metrics.completedDanBaDarom || 0}
                {metrics.totalDanBaDarom && (
                  <span className="text-sm font-bold text-blue-600/70 mr-1.5">/ {metrics.totalDanBaDarom}</span>
                )}
              </div>
              <span className="text-[11px] text-blue-600/90 font-bold mt-0.5 block">
                {metrics.totalDanBaDarom 
                  ? `${Math.round(((metrics.completedDanBaDarom || 0) / metrics.totalDanBaDarom) * 100)}% הושלמו`
                  : 'טיפולים שהושלמו'}
              </span>
            </div>
            {Boolean(metrics.totalDanBaDarom) && (
              <div className="w-full bg-blue-200/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.round(((metrics.completedDanBaDarom || 0) / metrics.totalDanBaDarom) * 100))}%` }}
                />
              </div>
            )}
          </div>

          {/* Dan Beer Sheva */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-emerald-900">דן באר שבע</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded">
                  {metrics.totalDanBeerSheva ? `${metrics.totalDanBeerSheva} אוטובוסים` : 'מפעיל'}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800">
                {metrics.completedDanBeerSheva || 0}
                {metrics.totalDanBeerSheva && (
                  <span className="text-sm font-bold text-emerald-600/70 mr-1.5">/ {metrics.totalDanBeerSheva}</span>
                )}
              </div>
              <span className="text-[11px] text-emerald-700 font-bold mt-0.5 block">
                {metrics.totalDanBeerSheva 
                  ? `${Math.round(((metrics.completedDanBeerSheva || 0) / metrics.totalDanBeerSheva) * 100)}% הושלמו`
                  : 'טיפולים שהושלמו'}
              </span>
            </div>
            {Boolean(metrics.totalDanBeerSheva) && (
              <div className="w-full bg-emerald-200/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.round(((metrics.completedDanBeerSheva || 0) / metrics.totalDanBeerSheva) * 100))}%` }}
                />
              </div>
            )}
          </div>

          {/* Closed in EDI */}
          <div className="bg-emerald-100/60 border border-emerald-300 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-emerald-900">סגור באדי</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-800">{metrics.ediClosed || 0}</div>
            <span className="text-[11px] text-emerald-700 font-bold mt-0.5 block">✓ סגורים ומעודכנים</span>
          </div>

          {/* Open in EDI */}
          <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-amber-900">פתוח באדי</span>
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-700">{metrics.ediOpen || 0}</div>
            <span className="text-[10px] text-amber-800 font-medium mt-0.5 block">
              {(metrics.totalCompleted && metrics.ediClosed) ? (metrics.totalCompleted - metrics.ediClosed) : (metrics.ediOpen || 0)} הושלמו
              {Boolean(metrics.followUpQueue) && ` + ${metrics.followUpQueue} המשך טיפול`}
            </span>
          </div>

        </div>
      </div>

      {/* Second Section: Operational Status Cards */}
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

      {/* Database Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">גיבוי ואבטחת מסד נתונים</h2>
                  <p className="text-xs text-slate-500">ניהול קבצי גיבוי ושחזור (SQLite Compressed GZIP)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification / status banner */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-black text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>מערכת גיבוי אוטומטית פעילה</span>
              </div>
              <p className="text-emerald-700 leading-relaxed">
                השרת מייצר באופן אוטומטי גיבוי דחוס מדי לילה ב-<strong>02:00</strong> ושומר את 30 הגיבויים האחרונים בתיקיית <code>data/backups/</code>.
              </p>
            </div>

            {backupMessage && (
              <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800">
                {backupMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/api/admin/backups/download-latest"
                download
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>הורד גיבוי עדכני למחשב (.db.gz)</span>
              </a>

              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <HardDrive className="w-4 h-4 text-slate-400" />
                <span>{creatingBackup ? 'יוצר גיבוי...' : 'בצע גיבוי חדש כעת'}</span>
              </button>
            </div>

            {/* Backups List */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">היסטוריית גיבויים קיימים בשרת:</span>
                <button
                  type="button"
                  onClick={loadBackups}
                  className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>רענן רשימה</span>
                </button>
              </div>

              {loadingBackups ? (
                <div className="text-center py-6 text-xs text-slate-400">טוען קבצי גיבוי...</div>
              ) : backups.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">טרם נוצרו קבצי גיבוי בשרת</div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {backups.map((b) => (
                    <div key={b.filename} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-mono font-bold text-slate-800">{b.filename}</div>
                        <div className="text-[11px] text-slate-400">
                          גודל: {b.sizeFormatted} | נוצר: {new Date(b.createdAt).toLocaleString('he-IL')}
                        </div>
                      </div>
                      <a
                        href={`/api/admin/backups/download/${encodeURIComponent(b.filename)}`}
                        download
                        title="הורד קובץ גיבוי זה"
                        className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cloud Sync Hint for TrueNAS / Google Drive */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">💡 סנכרון ישיר ל-Google Drive / OneDrive דרך TrueNAS:</span>
              <p>
                בממשק TrueNAS תחת <em>Data Protection ➔ Cloud Sync Tasks</em> ניתן לחבר את התיקייה <code>/root/tipulon/data/backups</code> ישירות ל-Google Drive האישי שלך לסנכרון אוטומטי מלא ללא צורך בהגדרות נוספות!
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
