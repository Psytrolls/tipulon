import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bus, Lock, Phone, ArrowLeft } from 'lucide-react';

export default function LoginView() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!phone || !pin) {
      setError('נא להזין מספר טלפון וקוד PIN');
      return;
    }

    setLoading(true);
    try {
      await login(phone, pin);
    } catch (err) {
      setError(err.message || 'שגיאה בהתחברות למערכת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-b from-emerald-50/50 to-slate-100">
      
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-200 mb-3">
          <Bus className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">טיפולון</h1>
        <p className="text-sm font-medium text-slate-600 mt-1">מערכת דיגיטלית לניהול טיפול מונע באוטובוסים</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 p-6 sm:p-8">
        
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">כניסה למערכת</h2>
          <p className="text-xs text-slate-500 mt-0.5">הזן את מספר הטלפון וקוד ה-PIN שהוקצו לך על ידי המנהל</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium flex items-center gap-2 animate-shake">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              מספר טלפון
            </label>
            <div className="relative">
              <input
                type="tel"
                dir="ltr"
                placeholder="050-1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left"
                autoComplete="tel"
                required
              />
              <Phone className="w-5 h-5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">9 עד 15 ספרות (ללא רווחים או מקפים)</span>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              קוד PIN סודי
            </label>
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                dir="ltr"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold tracking-widest focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left"
                autoComplete="current-password"
                required
              />
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">4 עד 8 ספרות</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>התחבר עכשיו</span>
                <ArrowLeft className="w-5 h-5" />
              </>
            )}
          </button>
        </form>



      </div>

      <footer className="mt-8 text-xs text-slate-400">
        מערכת טיפולון v1.0 • כל הזכויות שמורות
      </footer>
    </div>
  );
}
