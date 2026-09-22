import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, KeyRound, LogOut, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MustChangePasswordModal() {
  const { user, setAuthUser, logout } = useAuth();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validation criteria
  const hasMinLength = newPin.trim().length >= 6;
  const hasLetter = /[a-zA-Z]/.test(newPin);
  const hasDigit = /[0-9]/.test(newPin);
  const isMatching = newPin.trim().length > 0 && newPin === confirmPin;
  const isValid = hasMinLength && hasLetter && hasDigit && isMatching && currentPin.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isValid) {
      if (!currentPin.trim()) {
        setError('נא להזין את הסיסמה הנוכחית / הזמנית');
        return;
      }
      if (!hasMinLength) {
        setError('הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
        return;
      }
      if (!hasLetter || !hasDigit) {
        setError('הסיסמה חייבת לכלול שילוב של אותיות באנגלית ומספרים');
        return;
      }
      if (!isMatching) {
        setError('הסיסמה החדשה ואימות הסיסמה אינם תואמים');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: currentPin.trim(),
          newPin: newPin.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בעדכון הסיסמה');
      }

      // Update state to remove modal
      setAuthUser({
        ...user,
        mustChangePin: false
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white text-center relative">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight">נדרש עדכון סיסמה</h2>
          <p className="text-emerald-100 text-xs mt-1.5 leading-relaxed max-w-xs mx-auto">
            שלום <strong className="text-white underline">{user?.fullName || 'משתמש'}</strong>, מטעמי אבטחה יש להגדיר סיסמה אישית חדשה למערכת.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-bold animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Temporary Password */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              סיסמה נוכחית / קוד PIN זמני
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                dir="ltr"
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="הזן סיסמה נוכחית"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left text-sm"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex="-1"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              סיסמה חדשה (מינימום 6 תווים, אותיות ומספרים)
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                dir="ltr"
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="לדוגמה: Tipul2026"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left text-sm"
              />
              <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex="-1"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              אימות סיסמה חדשה
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                dir="ltr"
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="הקלד את הסיסמה החדשה שוב"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left text-sm"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex="-1"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Real-time Requirements Checklist */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 font-bold">
            <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-700' : 'text-slate-400'}`}>
              {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>לפחות 6 תווים באורך</span>
            </div>
            <div className={`flex items-center gap-2 ${hasLetter ? 'text-emerald-700' : 'text-slate-400'}`}>
              {hasLetter ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>כולל אותיות באנגלית (A-Z, a-z)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasDigit ? 'text-emerald-700' : 'text-slate-400'}`}>
              {hasDigit ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>כולל ספרות (0-9)</span>
            </div>
            <div className={`flex items-center gap-2 ${isMatching ? 'text-emerald-700' : 'text-slate-400'}`}>
              {isMatching ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>הסיסמאות תואמות זו לזו</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>שמור סיסמה והמשך למערכת</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full py-2 px-3 text-slate-500 hover:text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>התנתק מהמערכת</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
