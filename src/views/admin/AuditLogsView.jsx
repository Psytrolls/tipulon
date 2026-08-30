import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Clock, User, ShieldAlert } from 'lucide-react';

export default function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <History className="w-6 h-6" />
            </span>
            <span>יומן פעולות מערכת (Audit Log)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            תיעוד מלא ומאובטח של פעולות רגישות, שינויים במשתמשים, מוצרים ודוחות
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">רענן</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            טרם נרשמו פעולות ביומן
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
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
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
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

    </div>
  );
}
