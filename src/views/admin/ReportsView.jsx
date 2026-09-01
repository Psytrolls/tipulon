import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Eye, 
  X, 
  Bus, 
  Calendar, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export default function ReportsView({ initialReportId = null }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchBus, setSearchBus] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterEdi, setFilterEdi] = useState('');
  const [updatingEdiId, setUpdatingEdiId] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [downloadingOp, setDownloadingOp] = useState(null);

  // Report details modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleDownloadOperatorExcel = async (op = '') => {
    try {
      const opKey = op || 'all';
      setDownloadingOp(opKey);

      const url = op 
        ? `/api/treatments/export/excel?operator=${encodeURIComponent(op)}`
        : '/api/treatments/export/excel';

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'שגיאה בהורדת הקובץ');
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const opSlug = op === 'דן בדרום' ? 'dan_badarom' : op === 'דן באר שבע' ? 'dan_beer_sheva' : 'all_operators';
      const today = new Date().toISOString().slice(0, 10);
      const downloadFilename = `tipulon_reports_${opSlug}_${today}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setShowExportModal(false);
    } catch (err) {
      console.error('Download error:', err);
      alert(err.message || 'שגיאה בהורדת קובץ אקסל');
    } finally {
      setDownloadingOp(null);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchBus.trim()) params.append('busNumber', searchBus.trim());
      if (filterResult) params.append('result', filterResult);
      if (filterOperator) params.append('operator', filterOperator);
      if (filterEdi) params.append('ediStatus', filterEdi);

      const res = await fetch(`/api/treatments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle or update EDI status (Admin only)
  const handleToggleEdi = async (reportId, currentStatus) => {
    try {
      setUpdatingEdiId(reportId);
      const newStatus = !currentStatus;
      const res = await fetch(`/api/treatments/${reportId}/edi`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEdiClosed: newStatus })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'שגיאה בעדכון סטטוס אדי');
      }

      setReports(prev => prev.map(r => 
        r.id === reportId 
          ? { ...r, is_edi_closed: newStatus ? 1 : 0, edi_closed_at: newStatus ? new Date().toISOString() : null }
          : r
      ));

      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => ({
          ...prev,
          is_edi_closed: newStatus ? 1 : 0,
          edi_closed_at: newStatus ? new Date().toISOString() : null
        }));
      }
    } catch (err) {
      console.error('Failed to toggle EDI status:', err);
      alert(err.message || 'שגיאה בעדכון סטטוס אדי');
    } finally {
      setUpdatingEdiId(null);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filterResult, filterOperator, filterEdi]);

  useEffect(() => {
    if (initialReportId) {
      handleViewDetails(initialReportId);
    }
  }, [initialReportId]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    loadReports();
  };

  const handleViewDetails = async (reportId) => {
    try {
      setLoadingDetails(true);
      const res = await fetch(`/api/treatments/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReport(data);
      }
    } catch (err) {
      console.error('Failed to load report details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExportExcel = () => {
    window.location.href = '/api/treatments/export/excel';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </span>
            <span>דוחות והיסטוריית טיפולים</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            מעקב אחר כל דוחות הטיפול המונע שבוצעו על ידי טכנאי השטח
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowExportModal(true)}
            className="self-start sm:self-auto py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>ייצוא ל-Excel מעוצב (RTL)</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 items-center">
          
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="חיפוש לפי מספר אוטובוס..."
              value={searchBus}
              onChange={(e) => setSearchBus(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">כל המפעילים</option>
              <option value="דן באר שבע">דן באר שבע (3+ מכשירים)</option>
              <option value="דן בדרום">דן בדרום (מכשיר 1)</option>
            </select>
          </div>

          <div className="w-full sm:w-52">
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">כל תוצאות הטיפול</option>
              <option value="הכול תקין באוטובוס">הכול תקין באוטובוס</option>
              <option value="נדרש המשך טיפול של הלקוח">נדרש המשך טיפול של הלקוח</option>
            </select>
          </div>

          <div className="w-full sm:w-44">
            <select
              value={filterEdi}
              onChange={(e) => setFilterEdi(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">כל הסטטוסים באדי</option>
              <option value="closed">סגור באדי בלבד</option>
              <option value="open">פתוח באדי (טרם נסגר)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto py-2.5 px-5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors"
          >
            סנן
          </button>

          <button
            type="button"
            onClick={() => { setSearchBus(''); setFilterResult(''); setFilterOperator(''); setFilterEdi(''); loadReports(); }}
            className="w-full sm:w-auto p-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>איפוס</span>
          </button>
        </form>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            לא נמצאו דוחות טיפול התואמים לחיפוש
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">מזהה דוח</th>
                  <th className="p-3.5">מפעיל</th>
                  <th className="p-3.5">מספר אוטובוס</th>
                  <th className="p-3.5">טכנאי מבצע</th>
                  <th className="p-3.5">תאריך טיפול</th>
                  <th className="p-3.5">תוצאת טיפול</th>
                  <th className="p-3.5 text-center">סגור באדי</th>
                  <th className="p-3.5">מועד טיפול הבא</th>
                  <th className="p-3.5 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-700">#{report.id}</td>
                    <td className="p-3.5 font-bold text-slate-700">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        report.operator === 'דן בדרום' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {report.operator || 'דן באר שבע'}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-slate-900">{report.bus_number}</td>
                    <td className="p-3.5 text-slate-700">{report.technician_name}</td>
                    <td className="p-3.5 text-slate-500 font-medium">
                      {new Date(report.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="p-3.5 text-center">
                      {isAdmin ? (
                        <button
                          type="button"
                          disabled={updatingEdiId === report.id}
                          onClick={() => handleToggleEdi(report.id, report.is_edi_closed)}
                          title="לחץ לשינוי סטטוס סגור באדי"
                          className={`py-1 px-2.5 rounded-lg text-xs font-black border inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                            report.is_edi_closed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          } ${updatingEdiId === report.id ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {updatingEdiId === report.id ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                          ) : report.is_edi_closed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          )}
                          <span>{report.is_edi_closed ? 'סגור באדי' : 'פתוח באדי'}</span>
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold border ${
                          report.is_edi_closed
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {report.is_edi_closed ? '✓ סגור באדי' : 'פתוח באדי'}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {report.next_treatment_date 
                        ? new Date(report.next_treatment_date).toLocaleDateString('he-IL') 
                        : <span className="text-slate-400">לא נקבע</span>}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleViewDetails(report.id)}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>צפה</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">פרטי דוח טיפול מונע</span>
                <h2 className="text-xl font-black text-slate-900">
                  דוח #{selectedReport.id} - אוטובוס {selectedReport.bus_number}
                </h2>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metadata Card */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">מפעיל</span>
                <span className="font-bold text-slate-900 text-sm">{selectedReport.operator || 'דן באר שבע'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">מספר אוטובוס</span>
                <span className="font-bold text-slate-900 text-sm">{selectedReport.bus_number}</span>
              </div>
              <div>
                <span className="text-slate-400 block">טכנאי מבצע</span>
                <span className="font-bold text-slate-900 text-sm">{selectedReport.technician_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">תאריך ביצוע</span>
                <span className="font-bold text-slate-900 text-sm">
                  {new Date(selectedReport.created_at).toLocaleDateString('he-IL')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">סטטוס</span>
                <StatusBadge status={selectedReport.status} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-slate-400 block mb-1">סגור באדי</span>
                {isAdmin ? (
                  <button
                    type="button"
                    disabled={updatingEdiId === selectedReport.id}
                    onClick={() => handleToggleEdi(selectedReport.id, selectedReport.is_edi_closed)}
                    className={`py-1 px-2 rounded-lg text-xs font-black border transition-all text-center ${
                      selectedReport.is_edi_closed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                        : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                    }`}
                  >
                    {selectedReport.is_edi_closed ? '✓ סגור באדי' : '✕ סמן כסגור'}
                  </button>
                ) : (
                  <span className="font-bold text-slate-800">
                    {selectedReport.is_edi_closed ? 'סגור באדי' : 'פתוח באדי'}
                  </span>
                )}
              </div>
            </div>

            {/* Photo if available */}
            {selectedReport.photo_path && (
              <div>
                <span className="text-xs font-bold text-slate-500 block mb-2">צילום האוטובוס / לוחית רישוי:</span>
                <div className="rounded-2xl overflow-hidden border border-slate-200 max-h-60 flex justify-center bg-black/5">
                  <img
                    src={selectedReport.photo_path}
                    alt="צילום אוטובוס"
                    className="max-h-60 object-contain rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Devices Checklist */}
            <div>
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                מכשירים שנבדקו ({selectedReport.devices?.length || 0}):
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">מוצר</th>
                      <th className="p-2.5">מספר סידורי</th>
                      <th className="p-2.5">מצב</th>
                      <th className="p-2.5">הערה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReport.devices?.map((dev, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-800">{dev.product_name}</td>
                        <td className="p-2.5 font-mono text-slate-600" dir="ltr">{dev.serial_number}</td>
                        <td className="p-2.5">
                          <StatusBadge status={dev.status} />
                        </td>
                        <td className="p-2.5 text-slate-500">{dev.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block mb-1">סיכום והערות הטכנאי:</span>
              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedReport.summary}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="py-2.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                סגור
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Operator Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">ייצוא דוחות לאקסל</h3>
                  <p className="text-xs text-slate-500">בחר מאיזה מפעיל להפיק את קובץ ה-Excel:</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Dan Beer Sheva */}
              <button
                type="button"
                disabled={downloadingOp !== null}
                onClick={() => handleDownloadOperatorExcel('דן באר שבע')}
                className="w-full p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 hover:border-emerald-500 text-right transition-all flex items-center justify-between group disabled:opacity-60"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <h4 className="font-black text-sm text-slate-900 group-hover:text-emerald-900">
                      דן באר שבע
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">ייצוא דוחות אוטובוסי דן באר שבע בלבד</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                  {downloadingOp === 'דן באר שבע' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Option 2: Dan BaDarom */}
              <button
                type="button"
                disabled={downloadingOp !== null}
                onClick={() => handleDownloadOperatorExcel('דן בדרום')}
                className="w-full p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/60 hover:bg-blue-100/60 hover:border-blue-500 text-right transition-all flex items-center justify-between group disabled:opacity-60"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <h4 className="font-black text-sm text-slate-900 group-hover:text-blue-900">
                      דן בדרום
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">ייצוא דוחות אוטובוסי דן בדרום בלבד</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                  {downloadingOp === 'דן בדרום' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Option 3: All operators */}
              <button
                type="button"
                disabled={downloadingOp !== null}
                onClick={() => handleDownloadOperatorExcel('')}
                className="w-full p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400 text-right transition-all flex items-center justify-between group disabled:opacity-60"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                    <h4 className="font-black text-sm text-slate-900">
                      כל המפעילים (דוח מאוחד)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">ייצוא כל הטיפולים של כל המפעילים</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                  {downloadingOp === 'all' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </div>
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowExportModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 py-1 px-4 rounded-lg"
              >
                סגור
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
