import React from 'react';
import { CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';

export default function EdiConfirmationModal({
  isOpen,
  isClosing,
  busNumber,
  onConfirm,
  onCancel,
  loading = false,
  error = ''
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div 
        className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 text-right relative"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edi-modal-title"
      >
        {/* Close icon (disabled while loading) */}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 left-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="סגור חלון"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
            isClosing 
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
              : 'bg-amber-100 text-amber-700 border border-amber-200'
          }`}>
            {isClosing ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <RefreshCw className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 id="edi-modal-title" className="text-lg font-black text-slate-900">
              {isClosing ? 'סגירת דוח במערכת אדי (EDI)' : 'פתיחה מחדש של דוח באדי (EDI)'}
            </h3>
            {busNumber && (
              <span className="text-xs font-bold text-slate-500">
                אוטובוס מס׳: <span className="text-slate-800 font-black">{busNumber}</span>
              </span>
            )}
          </div>
        </div>

        {/* Message body */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 leading-relaxed">
          {isClosing ? (
            <p>האם אתה בטוח שברצונך לסגור את הדוח באדי (EDI)? לאחר האישור הדוח יסומן כסגור.</p>
          ) : (
            <p>האם אתה בטוח שברצונך לפתוח מחדש את הדוח באדי (EDI)?</p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all min-h-[44px] ${
              isClosing
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-emerald-600/30'
                : 'bg-amber-600 hover:bg-amber-700 active:scale-[0.98] shadow-amber-600/30'
            } disabled:opacity-50 disabled:cursor-wait`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>מעדכן סטטוס...</span>
              </>
            ) : (
              <span>{isClosing ? 'כן, סגור באדי' : 'כן, פתח מחדש'}</span>
            )}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="py-3 px-5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-xl transition-colors min-h-[44px] flex items-center justify-center disabled:opacity-40"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
