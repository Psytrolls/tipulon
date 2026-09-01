import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';

export default function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed / standalone
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                             window.navigator.standalone === true;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) return;

    // Check dismissed today
    const lastDismissed = localStorage.getItem('pwa_dismissed_at');
    if (lastDismissed && Date.now() - Number(lastDismissed) < 24 * 60 * 60 * 1000) {
      setDismissed(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Android / Desktop Chrome beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_dismissed_at', String(Date.now()));
  };

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <aside 
      aria-label="התקנת אפליקציה" 
      className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-slate-900 text-white p-3 sm:p-4 shadow-xl border-b border-emerald-600/50 sticky top-0 z-50 transition-all"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <Smartphone className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="font-black text-white flex items-center gap-1.5">
              <span>התקנת אפליקציית טיפולון למסך הבית</span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded font-bold border border-emerald-400/30">
                PWA
              </span>
            </div>
            {isIOS ? (
              <p className="text-emerald-100/90 text-[11px] sm:text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                <span>להתקנה ב-iPhone: לחץ על</span>
                <span className="inline-flex items-center gap-0.5 bg-white/20 px-1.5 py-0.2 rounded font-bold">
                  <Share className="w-3 h-3" /> שתף
                </span>
                <span>ואז בחר</span>
                <span className="inline-flex items-center gap-0.5 bg-white/20 px-1.5 py-0.2 rounded font-bold">
                  <PlusSquare className="w-3 h-3" /> הוסף למסך הבית
                </span>
              </p>
            ) : (
              <p className="text-emerald-100/90 text-[11px] sm:text-xs mt-0.5">
                עבודה מהירה במסך מלא ללא דפדפן מותאמת לשטח
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="py-1.5 px-3.5 bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs rounded-xl shadow transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>התקן עכשיו</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            aria-label="סגור הודעה"
            className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-200 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </aside>
  );
}
