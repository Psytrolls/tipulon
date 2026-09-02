import React, { useState, useEffect } from 'react';
import { 
  Bus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Calendar,
  Building2
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

export default function FleetView({ onSelectBusReports }) {
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    treatedValid: 0,
    pendingTreatment: 0,
    progressPercent: 0,
    danBeerSheva: { total: 0, treatedValid: 0, pendingTreatment: 0, progressPercent: 0 },
    danBaDarom: { total: 0, treatedValid: 0, pendingTreatment: 0, progressPercent: 0 },
    hubs: []
  });

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [operator, setOperator] = useState(''); // '' = all, 'דן באר שבע', 'דן בדרום'
  const [status, setStatus] = useState(''); // '' = all, 'valid', 'pending'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredCount, setFilteredCount] = useState(0);

  // Sync state
  const [syncingFleet, setSyncingFleet] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');

  const loadFleetData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (operator) params.append('operator', operator);
      if (status) params.append('status', status);
      params.append('page', String(page));
      params.append('limit', '50');

      const res = await fetch(`/api/buses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBuses(data.buses || []);
        if (data.summary) setSummary(data.summary);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setFilteredCount(data.pagination.total || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load fleet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFleetData();
  }, [page, operator, status]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setPage(1);
    loadFleetData();
  };

  const handleSyncFleet = async () => {
    try {
      setSyncingFleet(true);
      setSyncNotice('');
      const res = await fetch('/api/buses/sync-fleet', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncNotice(`✅ סונכרנו ${data.totalBusesInDb} אוטובוסים (${data.totalAdded} חדשים).`);
        loadFleetData();
        setTimeout(() => setSyncNotice(''), 6000);
      } else {
        setSyncNotice(`⚠️ שגיאה בסנכרון: ${data.error}`);
      }
    } catch (e) {
      setSyncNotice('⚠️ שגיאה בהתחברות למאגר משרד התחבורה');
    } finally {
      setSyncingFleet(false);
    }
  };

  // Active KPI numbers depending on operator selection
  const activeKpi = operator === 'דן באר שבע'
    ? summary.danBeerSheva
    : operator === 'דן בדרום'
    ? summary.danBaDarom
    : {
        total: summary.total,
        treatedValid: summary.treatedValid,
        pendingTreatment: summary.pendingTreatment,
        progressPercent: summary.progressPercent
      };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Bus className="w-6 h-6" />
            </span>
            <span>צי אוטובוסים ומעקב ביצוע</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            מעקב אחר כל צי הרכבים, פילוח לפי חברות, חניונים ואוטובוסים שטופלו מול אלו שנותרו
          </p>
        </div>

        <button
          onClick={handleSyncFleet}
          disabled={syncingFleet}
          className="self-start sm:self-auto py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
          title="סנכרון מלא מול מאגר משרד התחבורה Data.gov.il"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${syncingFleet ? 'animate-spin' : ''}`} />
          <span>{syncingFleet ? 'מסנכרן...' : 'סנכרן צי ממשרד התחבורה'}</span>
        </button>
      </div>

      {syncNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 animate-fadeIn">
          {syncNotice}
        </div>
      )}

      {/* Operator Segmentation Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl w-full sm:w-max overflow-x-auto">
        <button
          type="button"
          onClick={() => { setOperator(''); setPage(1); }}
          className={`flex-1 sm:flex-none py-2.5 px-5 rounded-xl text-xs font-black transition-all ${
            !operator
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          כל הצי המאוחד ({summary.total})
        </button>

        <button
          type="button"
          onClick={() => { setOperator('דן באר שבע'); setPage(1); }}
          className={`flex-1 sm:flex-none py-2.5 px-5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            operator === 'דן באר שבע'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${operator === 'דן באר שבע' ? 'bg-white' : 'bg-emerald-500'}`}></span>
          <span>דן באר שבע ({summary.danBeerSheva?.total || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => { setOperator('דן בדרום'); setPage(1); }}
          className={`flex-1 sm:flex-none py-2.5 px-5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            operator === 'דן בדרום'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${operator === 'דן בדרום' ? 'bg-white' : 'bg-blue-500'}`}></span>
          <span>דן בדרום ({summary.danBaDarom?.total || 0})</span>
        </button>
      </div>

      {/* Company Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Dan Beer Sheva Card */}
        <div 
          onClick={() => { setOperator('דן באר שבע'); setPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            operator === 'דן באר שבע' 
              ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500' 
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              <span className="font-black text-slate-900 text-sm">דן באר שבע</span>
              <span className="text-[11px] text-slate-400 font-medium">({summary.danBeerSheva?.total || 0} אוטובוסים)</span>
            </div>
            <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg">
              {summary.danBeerSheva?.progressPercent || 0}% הושלמו
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
            <span>טופלו ובתוקף: <strong className="text-emerald-700 text-sm">{summary.danBeerSheva?.treatedValid || 0}</strong></span>
            <span>נותרו לביצוע: <strong className="text-amber-700 text-sm">{summary.danBeerSheva?.pendingTreatment || 0}</strong></span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.danBeerSheva?.progressPercent || 0)}%` }}
            ></div>
          </div>
        </div>

        {/* Dan BaDarom Card */}
        <div 
          onClick={() => { setOperator('דן בדרום'); setPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            operator === 'דן בדרום' 
              ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500' 
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
              <span className="font-black text-slate-900 text-sm">דן בדרום</span>
              <span className="text-[11px] text-slate-400 font-medium">({summary.danBaDarom?.total || 0} אוטובוסים)</span>
            </div>
            <span className="text-xs font-black text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-lg">
              {summary.danBaDarom?.progressPercent || 0}% הושלמו
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
            <span>טופלו ובתוקף: <strong className="text-blue-700 text-sm">{summary.danBaDarom?.treatedValid || 0}</strong></span>
            <span>נותרו לביצוע: <strong className="text-amber-700 text-sm">{summary.danBaDarom?.pendingTreatment || 0}</strong></span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.danBaDarom?.progressPercent || 0)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Active Depots / Hubs Filter Chips */}
      {summary.hubs && summary.hubs.length > 0 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-700">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>מתחמי חניה וחניונים פעילים (לחץ לסינון מהיר לפי חניון):</span>
            </span>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(1); }}
                className="text-[10px] text-rose-600 hover:underline font-bold"
              >
                נקה סינון חניון ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {summary.hubs.map((h) => {
              const isSelected = search === h.city || search === h.name;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSearch('');
                    } else {
                      setSearch(h.city);
                      setOperator(h.operator);
                    }
                    setPage(1);
                  }}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 active:scale-95 ${
                    isSelected 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>📍 {h.name}</span>
                  <span className="text-[10px] opacity-75">({h.city})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Stats for Current Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* Total in Current View */}
        <div 
          onClick={() => { setStatus(''); setPage(1); }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {operator ? `סה"כ ${operator}` : 'סה"כ כל הצי'}
            </span>
            <Bus className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {activeKpi.total || 0}
          </div>
          <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">
            אוטובוסים רשומים במערכת
          </span>
        </div>

        {/* Treated & Valid */}
        <div 
          onClick={() => { setStatus(prev => prev === 'valid' ? '' : 'valid'); setPage(1); }}
          className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
            status === 'valid'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">טופלו ובתוקף</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {activeKpi.treatedValid || 0}
          </div>
          <span className="text-[11px] text-emerald-600 block mt-0.5 font-medium">
            תוקף 6 חודשים פעיל
          </span>
        </div>

        {/* Pending Treatment */}
        <div 
          onClick={() => { setStatus(prev => prev === 'pending' ? '' : 'pending'); setPage(1); }}
          className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
            status === 'pending'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">נותרו לביצוע</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {activeKpi.pendingTreatment || 0}
          </div>
          <span className="text-[11px] text-amber-600 block mt-0.5 font-medium">
            טרם טופלו / דורשים טיפול
          </span>
        </div>

        {/* Progress Percent */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">אחוז התקדמות</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {activeKpi.progressPercent || 0}%
          </div>
          <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">
            {activeKpi.treatedValid || 0} מתוך {activeKpi.total || 0}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 items-center">
          
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="חיפוש לפי מספר אוטובוס, מספר קצר, חניון או עיר..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">כל הסטטוסים</option>
              <option value="valid">🟢 טופלו ובתוקף</option>
              <option value="pending">⏳ נותרו לביצוע</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto py-2.5 px-5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors"
          >
            חפש
          </button>

          <button
            type="button"
            onClick={() => { setSearch(''); setOperator(''); setStatus(''); setPage(1); }}
            className="w-full sm:w-auto p-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>איפוס</span>
          </button>
        </form>
      </div>

      {/* Fleet Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : buses.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            לא נמצאו אוטובוסים התואמים לסינון הנוכחי
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">מפעיל</th>
                  <th className="p-3.5">מספר רישוי</th>
                  <th className="p-3.5">מספר קצר</th>
                  <th className="p-3.5">דגם ושנת ייצור</th>
                  <th className="p-3.5">סטטוס טיפול מונע</th>
                  <th className="p-3.5">טיפול אחרון</th>
                  <th className="p-3.5">מועד טיפול הבא</th>
                  <th className="p-3.5">סניף / מיקום</th>
                  <th className="p-3.5 text-center">היסטוריה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buses.map((b) => {
                  const hasValid = b.next_treatment_date && new Date(b.next_treatment_date) > new Date();
                  return (
                    <tr key={b.bus_number} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-700">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          b.operator === 'דן בדרום' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {b.operator || 'דן באר שבע'}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-slate-900 font-mono text-sm">{b.bus_number}</td>
                      <td className="p-3.5 font-bold text-slate-700 font-mono">
                        {b.short_number && b.short_number !== b.bus_number ? b.short_number : '-'}
                      </td>
                      <td className="p-3.5 text-slate-600 font-medium">
                        {b.bus_type || 'אוטובוס עירוני'} {b.production_year ? `(${b.production_year})` : ''}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border inline-flex items-center gap-1 ${
                          hasValid
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : b.status === 'נדרש טיפול' || b.last_treatment_date
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}>
                          {hasValid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>טיפול בתוקף</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span>{b.last_treatment_date ? 'נדרש טיפול' : 'טרם טופל'}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {b.last_treatment_date ? (
                          <div>
                            <span className="font-bold">{new Date(b.last_treatment_date).toLocaleDateString('he-IL')}</span>
                            {b.last_technician_name && (
                              <span className="text-[10px] text-slate-400 block">ע"י {b.last_technician_name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">טרם בוצע</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 font-bold">
                        {b.next_treatment_date ? (
                          <span className={hasValid ? 'text-emerald-700 font-black' : 'text-rose-600'}>
                            {new Date(b.next_treatment_date).toLocaleDateString('he-IL')}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">לא נקבע</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 font-medium">
                        {b.last_known_location || b.cluster || 'מרכז תפעול'}
                      </td>
                      <td className="p-3.5 text-center">
                        {b.reports_count > 0 ? (
                          <button
                            type="button"
                            onClick={() => onSelectBusReports && onSelectBusReports(b.bus_number)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1 mx-auto transition-colors"
                            title="הצג דוחות עבור אוטובוס זה"
                          >
                            <span>{b.reports_count} דוחות</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-medium">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
            <span>מוצגים {buses.length} מתוך {filteredCount} אוטובוסים</span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 bg-slate-100 rounded-lg">
                עמוד {page} מתוך {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
