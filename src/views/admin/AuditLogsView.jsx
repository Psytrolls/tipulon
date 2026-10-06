import React, { useState, useEffect } from 'react';
import { 
  History, 
  RefreshCw, 
  ShieldCheck, 
  Database, 
  Download, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AuditLogsView() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Backup state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showConfirmCreate, setShowConfirmCreate] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupNotice, setBackupNotice] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const res = await fetch('/api/admin/backups');
      if (res.ok) {
        const json = await res.json();
        setBackups(json);
      }
    } catch (e) {
      console.error('Failed to load backups:', e);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (showBackupModal) {
      loadBackups();
    }
  }, [showBackupModal]);

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      setBackupNotice('');
      setShowConfirmCreate(false);
      const res = await fetch('/api/admin/backups/create', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setBackupNotice(`✅ גיבוי מוצפן נוצר בהצלחה: ${data.filename} (${data.sizeFormatted})`);
        loadBackups();
      } else {
        setBackupNotice(`⚠️ שגיאה ביצירת הגיבוי: ${data.error}`);
      }
    } catch (e) {
      setBackupNotice('⚠️ שגיאה בהתחברות לשרת ליצירת הגיבוי');
    } finally {
      setCreatingBackup(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header with System Backup Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <History className="w-6 h-6" />
            </span>
            <span>יומן פעולות ואבטחת מערכת</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
            תיעוד מאובטח של כל הפעולות הרגישות, שינויי סטטוס וניהול גיבויי מסד הנתונים
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => { setShowBackupModal(true); setBackupNotice(''); }}
            className="py-2.5 px-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-all flex items-center gap-2 text-xs font-black shadow-2xs active:scale-95 min-h-[44px]"
            title="ניהול גיבויי מסד נתונים"
          >
            <Database className="w-4 h-4 text-emerald-600" />
            <span>ניהול גיבויים ומסד נתונים</span>
          </button>

          <button
            onClick={loadLogs}
            className="p-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold min-h-[44px]"
            title="רענן יומן פעולות"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">רענן</span>
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm font-bold">
            טרם נרשמו פעולות ביומן
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">זמן</th>
                  <th className="p-3.5">משתמש</th>
                  <th className="p-3.5">פעולה</th>
                  <th className="p-3.5">ישות מושפעת</th>
                  <th className="p-3.5">פרטים נוספים</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('he-IL')}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">
                      {log.user_name || 'מערכת'}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700">
                      {log.entity} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Database Backup Management Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
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
                onClick={() => { setShowBackupModal(false); setShowConfirmCreate(false); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label="סגור חלון"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification / status banner */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs text-emerald-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>מערכת גיבוי אוטומטית פעילה (הצפנת AES-256-GCM)</span>
                </div>
                {user?.isSuperAdmin && (
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-black rounded-full">
                    הרשאת מנהל-על
                  </span>
                )}
              </div>
              <p className="text-emerald-800 leading-relaxed font-medium">
                השרת מייצר גיבוי מוצפן ודחוס מדי לילה ב-<strong>02:00</strong> ושומר את 30 הגיבויים האחרונים. כל קבצי הגיבוי מוצפנים בהצפנה צבאית.
              </p>
            </div>

            {backupNotice && (
              <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-black text-slate-900 animate-fadeIn">
                {backupNotice}
              </div>
            )}

            {/* Manual Backup Action with Confirmation */}
            {user?.isSuperAdmin ? (
              <div className="space-y-3 pt-1">
                {showConfirmCreate ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3 animate-fadeIn">
                    <div className="flex items-start gap-2 text-amber-900 text-xs font-black">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>האם ליצור כעת גיבוי מוצפן מלא של מסד הנתונים?</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCreateBackup}
                        disabled={creatingBackup}
                        className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-sm transition-all min-h-[44px]"
                      >
                        {creatingBackup ? 'יוצר גיבוי...' : 'כן, צור גיבוי עכשיו'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmCreate(false)}
                        className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors min-h-[44px]"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setShowConfirmCreate(true)}
                      disabled={creatingBackup}
                      className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all min-h-[44px]"
                    >
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <span>צור גיבוי מסד נתונים כעת</span>
                    </button>

                    <a
                      href="/api/admin/backups/download-latest"
                      download
                      className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all min-h-[44px]"
                    >
                      <Download className="w-4 h-4" />
                      <span>הורד גיבוי אחרון</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>הורדה ויצירה יזומה של גיבויים מורשית למנהל-על (Super Admin) בלבד.</span>
              </div>
            )}

            {/* Backups List */}
            {user?.isSuperAdmin && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">היסטוריית גיבויים קיימים בשרת:</span>
                  <button
                    type="button"
                    onClick={loadBackups}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 min-h-[36px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>רענן רשימה</span>
                  </button>
                </div>

                {loadingBackups ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-bold">טוען קבצי גיבוי...</div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-bold">טרם נוצרו קבצי גיבוי בשרת</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {backups.map((b) => (
                      <div key={b.filename} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5" dir="ltr">
                            <span>{b.filename}</span>
                            {b.isEncrypted && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded">
                                AES Encrypted
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            גודל: {b.sizeFormatted} | נוצר: {new Date(b.createdAt).toLocaleString('he-IL')}
                          </div>
                        </div>
                        <a
                          href={`/api/admin/backups/download/${encodeURIComponent(b.filename)}`}
                          download
                          title="הורד קובץ גיבוי זה"
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                          aria-label={`הורד קובץ ${b.filename}`}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cloud Sync Hint for TrueNAS / Google Drive */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-1">
              <span className="font-black text-slate-800 block">💡 סנכרון ישיר ל-Google Drive דרך TrueNAS:</span>
              <p className="leading-relaxed">
                בממשק TrueNAS תחת <em>Data Protection ➔ Cloud Sync Tasks</em> ניתן לחבר את התיקייה <code>/root/tipulon/data/backups</code> ישירות ל-Google Drive האישי שלך לסנכרון אוטומטי מלא.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
