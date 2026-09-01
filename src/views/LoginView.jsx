import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bus, Lock, Phone, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import InstallPwaBanner from '../components/InstallPwaBanner';

export default function LoginView() {
  const { setAuthUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [userName, setUserName] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!phone || !pin) {
      setError('נא להזין מספר טלפון וקוד PIN');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בהתחברות למערכת');
      }

      setUserName(data.user?.fullName || '');
      setLoginSuccess(true);

      // Smooth 900ms delay to let the user enjoy the welcome animation
      setTimeout(() => {
        setAuthUser(data.user);
      }, 900);
    } catch (err) {
      setError(err.message || 'שגיאה בהתחברות למערכת');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 overflow-hidden">
      <div className="fixed top-0 left-0 right-0 z-50">
        <InstallPwaBanner />
      </div>
      
      {/* Decorative Animated Background Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Brand Header */}
      <div className="relative text-center mb-6 z-10 transition-all duration-700">
        <div className={`relative w-20 h-20 mx-auto mb-3 transition-all duration-700 ${loginSuccess ? 'scale-110' : 'hover:scale-105'}`}>
          <div className="absolute inset-0 bg-emerald-500 rounded-3xl blur-md opacity-60 animate-pulse"></div>
          <div className="relative w-full h-full bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-2xl border border-emerald-400/30">
            {loginSuccess ? (
              <CheckCircle2 className="w-11 h-11 text-white animate-scaleCheck" />
            ) : (
              <Bus className="w-11 h-11 transition-transform duration-500 group-hover:rotate-6" />
            )}
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center justify-center gap-2">
          <span>טיפולון</span>
          <Sparkles className="w-5 h-5 text-emerald-400 animate-spin-slow" />
        </h1>
        <p className="text-xs sm:text-sm font-medium text-emerald-200/70 mt-1">מערכת דיגיטלית חכמה לניהול טיפול מונע באוטובוסים</p>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/40 border border-white/20 p-6 sm:p-8 z-10 transition-all duration-500">
        
        {loginSuccess ? (
          /* Success Screen Animation */
          <div className="py-8 text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-inner animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">
                {userName ? `ברוך הבא, ${userName}!` : 'התחברת בהצלחה!'}
              </h2>
              <p className="text-sm font-medium text-slate-500">טוען את נתוני המערכת עבורך...</p>
            </div>
            <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-indeterminate"></div>
            </div>
          </div>
        ) : (
          /* Standard Login Form */
          <>
            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-900">כניסה למערכת</h2>
              <p className="text-xs text-slate-500 mt-0.5">הזן מספר טלפון וקוד PIN סודי</p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center gap-2 animate-shake">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  מספר טלפון
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="050-1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left"
                    autoComplete="tel"
                    required
                  />
                  <Phone className="w-5 h-5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-black tracking-widest focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left"
                    autoComplete="current-password"
                    required
                  />
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white font-black text-base rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
          </>
        )}

      </div>

      {/* Footer info */}
      <div className="relative text-center mt-6 z-10 text-[11px] text-emerald-200/50">
        מאובטח בטכנולוגיית הצפנה מתקדמת • גרסה 2.0
      </div>

    </div>
  );
}
