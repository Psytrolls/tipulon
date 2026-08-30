import React, { useState, useEffect, useRef } from 'react';
import { 
  Bus, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight, 
  ShieldAlert, 
  Check, 
  X, 
  FileCheck, 
  Sparkles,
  Info,
  Clock,
  Scan,
  RefreshCw
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

export default function NewTreatmentView({ onTreatmentCompleted }) {
  // Wizard Steps: 1 = Bus & Photo, 2 = Device Count, 3 = Fill Devices, 4 = Summary & Decision, 5 = Review, 6 = Success
  const [step, setStep] = useState(1);

  // Step 1 State: Bus & Photo & Operator
  const [operator, setOperator] = useState('דן באר שבע'); // 'דן באר שבע' or 'דן בדרום'
  const [busNumber, setBusNumber] = useState('');
  const [busInfo, setBusInfo] = useState(null);
  const [searchingBus, setSearchingBus] = useState(false);
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const [busError, setBusError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [detectedCandidates, setDetectedCandidates] = useState([]);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');

  const cameraInputRef = useRef(null);

  // Products from DB
  const [activeProducts, setActiveProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Step 2 State: Device count (1 to 12 for Dan BaDarom, 3 to 12 for Dan Beer Sheva)
  const [deviceCount, setDeviceCount] = useState(4);

  // Step 3 State: Devices checklist
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [devices, setDevices] = useState([]);

  // Step 4 State: Summary & Decision
  const [summary, setSummary] = useState('');
  const [decision, setDecision] = useState('הכול תקין באוטובוס');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedReport, setSubmittedReport] = useState(null);
  const [lastCompletedNotification, setLastCompletedNotification] = useState(null);

  // Fetch active products on mount
  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActiveProducts(data);
        }
      })
      .catch(err => console.error('Failed to load products:', err))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Handle manual bus lookup
  const handleSearchBus = async (numberToSearch = null) => {
    const targetNumber = (numberToSearch || busNumber).replace(/[^0-9]/g, '').trim();
    if (!targetNumber) {
      setBusError('נא להזין מספר אוטובוס לבדיקה');
      return;
    }

    setSearchingBus(true);
    setBusError('');
    setBusInfo(null);

    try {
      const res = await fetch(`/api/buses/search/${encodeURIComponent(targetNumber)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה באיתור אוטובוס');
      }
      setBusInfo(data);
      setBusNumber(targetNumber);
    } catch (err) {
      setBusError(err.message);
    } finally {
      setSearchingBus(false);
    }
  };

  // Handle Photo Capture + Automatic OCR Recognition
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    setPhotoError('');
    setOcrSuccessMsg('');
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setPhotoError('גודל הצילום עולה על 4MB. נא לבחור תמונה קטנה יותר');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Send to OCR Scan
    setScanningPhoto(true);
    setBusError('');

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch('/api/buses/scan-photo', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בסריקת התמונה');
      }

      if (data.detectedNumber) {
        setBusNumber(data.detectedNumber);
        setDetectedCandidates(data.candidates || []);
        setOcrSuccessMsg(`זוהה בהצלחה מספר אוטובוס: ${data.detectedNumber}`);
        if (data.busInfo) {
          setBusInfo(data.busInfo);
        } else {
          handleSearchBus(data.detectedNumber);
        }
      } else {
        setOcrSuccessMsg('התמונה נקלטה, אך לא זוהה מספר ברור. ניתן להקליד את המספר ידנית למטה.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setPhotoError('לא הצלחנו לפענח את המספר מהתמונה, אנא הזן ידנית');
    } finally {
      setScanningPhoto(false);
    }
  };

  // Move from Step 1 to Step 2
  const handleProceedToCount = () => {
    if (!busInfo) {
      setBusError('נא לבצע בדיקת אוטובוס לפני המשך');
      return;
    }
    if (!busInfo.canStartTreatment) {
      return; // Blocked by business rule
    }
    setStep(2);
  };

  // Move from Step 2 to Step 3 (Initialize devices array)
  const handleInitDevices = () => {
    const initialDevices = [];
    for (let i = 0; i < deviceCount; i++) {
      initialDevices.push(
        devices[i] || {
          productName: activeProducts[0]?.name || '',
          productId: activeProducts[0]?.id || null,
          serialNumber: '',
          status: 'תקין',
          notes: ''
        }
      );
    }
    setDevices(initialDevices);
    setCurrentDeviceIndex(0);
    setStep(3);
  };

  // Update specific device in state
  const handleUpdateDevice = (field, value) => {
    const updated = [...devices];
    if (field === 'productName') {
      const found = activeProducts.find(p => p.name === value);
      updated[currentDeviceIndex] = {
        ...updated[currentDeviceIndex],
        productName: value,
        productId: found?.id || null
      };
    } else {
      updated[currentDeviceIndex] = {
        ...updated[currentDeviceIndex],
        [field]: value
      };
    }
    setDevices(updated);
  };

  const isCurrentDeviceValid = () => {
    const current = devices[currentDeviceIndex];
    if (!current) return false;
    if (!current.productName) return false;
    if (!current.serialNumber.trim()) return false;
    if (!current.status) return false;
    return true;
  };

  const handleNextDevice = () => {
    if (!isCurrentDeviceValid()) {
      alert('חובה לבחור סוג מוצר ולהזין מספר סידורי');
      return;
    }

    if (currentDeviceIndex < deviceCount - 1) {
      setCurrentDeviceIndex(prev => prev + 1);
    } else {
      setStep(4);
    }
  };

  const handlePrevDevice = () => {
    if (currentDeviceIndex > 0) {
      setCurrentDeviceIndex(prev => prev - 1);
    } else {
      setStep(2);
    }
  };

  // Submit report to server
  const handleSubmitReport = async () => {
    if (!summary.trim()) {
      setSubmitError('סיכום הטיפול והערות הטכנאי הוא שדה חובה');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('busNumber', busNumber.trim());
      formData.append('operator', operator);
      formData.append('summary', summary.trim());
      formData.append('result', decision);
      formData.append('devices', JSON.stringify(devices));

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const res = await fetch('/api/treatments', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בשמירת דוח הטיפול');
      }

      setSubmittedReport(data);
      setLastCompletedNotification({
        reportId: data.reportId,
        busNumber: data.busNumber,
        status: data.status,
        createdAt: data.createdAt
      });
      resetForm();
      if (onTreatmentCompleted) onTreatmentCompleted();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setBusNumber('');
    setBusInfo(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setDevices([]);
    setSummary('');
    setDecision('הכול תקין באוטובוס');
    setSubmittedReport(null);
    setDetectedCandidates([]);
    setOcrSuccessMsg('');
    setCurrentDeviceIndex(0);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      
      {/* Wizard Header Progress */}
      {step < 6 && (
        <div className="mb-6 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2 text-xs font-bold text-slate-500">
            <span>שלב {step} מתוך 5</span>
            <span>
              {step === 1 && 'זיהוי אוטובוס ובדיקת זכאות'}
              {step === 2 && 'הגדרת כמות מכשירים'}
              {step === 3 && `מילוי מכשירים (${currentDeviceIndex + 1}/${deviceCount})`}
              {step === 4 && 'סיכום והחלטה'}
              {step === 5 && 'סקירה ואישור סופי'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* STEP 1: Bus Identification (Camera OCR or Manual input) */}
      {step === 1 && (
        <div className="space-y-4">
          {lastCompletedNotification && (
            <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    הדוח לאוטובוס {lastCompletedNotification.busNumber} נשמר בהצלחה!
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    דוח #{lastCompletedNotification.reportId} • המערכת מוכנה מיד לסריקת האוטובוס הבא 📸
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLastCompletedNotification(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Bus className="w-6 h-6 text-emerald-600" />
                <span>שלב 1: זיהוי האוטובוס ובדיקת משימה</span>
              </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              בחר מפעיל, צלם את לוחית הרישוי או הקלד מספר לבדיקה מיידית
            </p>
          </div>

          {/* Operator Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">מפעיל תחבורה ציבורית:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setOperator('דן באר שבע');
                  setDeviceCount(prev => Math.max(3, prev));
                }}
                className={`p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1 border-2 transition-all ${
                  operator === 'דן באר שבע'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-black text-slate-900">דן באר שבע</span>
                <span className="text-[11px] text-emerald-700 font-semibold">מינימום 3 מכשירים</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOperator('דן בדרום');
                  setDeviceCount(1);
                }}
                className={`p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1 border-2 transition-all ${
                  operator === 'דן בדרום'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 shadow-sm ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-black text-slate-900">דן בדרום</span>
                <span className="text-[11px] text-blue-700 font-semibold">מכשיר 1 בלבד</span>
              </button>
            </div>
          </div>

          {/* Camera OCR Action Banner */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-slate-50 border-2 border-dashed border-emerald-500/40 rounded-2xl p-5 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              {scanningPhoto ? (
                <span className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Camera className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                {scanningPhoto ? 'מפענח מספר אוטובוס מהתמונה...' : 'סריקה וזיהוי אוטומטי מתמונה'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                צלם ישירות במצלמת הנייד את מספר האוטובוס או לוחית הרישוי
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-1">
              <label className="cursor-pointer py-3 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-black rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-2 transition-all">
                <Scan className="w-5 h-5" />
                <span>{scanningPhoto ? 'מבצע סריקת OCR...' : 'צלם או בחר תמונה'}</span>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={scanningPhoto}
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
              </label>
            </div>

            {ocrSuccessMsg && (
              <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-center gap-2 animate-fadeIn">
                <Sparkles className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>{ocrSuccessMsg}</span>
              </div>
            )}

            {photoError && (
              <p className="text-xs font-bold text-rose-600">{photoError}</p>
            )}

            {photoPreview && (
              <div className="relative w-24 h-24 mx-auto rounded-xl overflow-hidden border-2 border-emerald-500 shadow-sm mt-2">
                <img src={photoPreview} alt="צילום שנסרק" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); setOcrSuccessMsg(''); }}
                  className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 shadow"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Alternative Candidates Chips (if OCR found multiple numbers) */}
          {detectedCandidates.length > 1 && (
            <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 block">מספרים נוספים שזוהו בתמונה:</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {detectedCandidates.map((cand) => (
                  <button
                    key={cand}
                    type="button"
                    onClick={() => handleSearchBus(cand)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${
                      busNumber === cand
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {cand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-xs font-bold text-slate-400 absolute">או הזן מספר ידנית</span>
          </div>

          {/* Manual Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">מספר אוטובוס (לוחית או מספר צי)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={busNumber}
                onChange={(e) => setBusNumber(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchBus()}
                placeholder="לדוגמה: 1234567 או 4215"
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => handleSearchBus()}
                disabled={searchingBus || !busNumber.trim()}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {searchingBus ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'בדוק'}
              </button>
            </div>
            {busError && <p className="text-xs font-semibold text-rose-600">{busError}</p>}
          </div>

          {/* Bus Check Result Banner */}
          {busInfo && (
            <div className="p-5 rounded-2xl border transition-all space-y-3 bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-800">
                  בדיקת זכאות לאוטובוס {busInfo.busNumber}:
                </span>
                <StatusBadge status={busInfo.status} />
              </div>

              {/* Blocking Condition: Treatment already valid */}
              {!busInfo.canStartTreatment ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 space-y-1.5 animate-fadeIn">
                  <div className="flex items-center gap-2 font-black text-sm text-rose-700">
                    <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <span>אין צורך בביצוע טיפול מונע לאוטובוס זה!</span>
                  </div>
                  <p className="text-xs font-medium text-rose-800 pr-7">
                    {busInfo.blockReason || 'לאוטובוס קיים טיפול מונע בתוקף ואין צורך בביצוע טיפול כפול.'}
                  </p>
                  {busInfo.lastTechnicianName && (
                    <p className="text-[11px] text-rose-600 pr-7">
                      בוצע לאחרונה ע״י: <strong>{busInfo.lastTechnicianName}</strong>
                    </p>
                  )}
                </div>
              ) : (
                /* Allowed Condition: Treatment needed or new bus */
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-1.5 animate-fadeIn">
                  <div className="flex items-center gap-2 font-black text-sm text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>האוטובוס מאושר לביצוע טיפול מונע!</span>
                  </div>
                  <p className="text-xs text-emerald-800 pr-7">
                    {busInfo.message || 'האוטובוס נדרש לבדיקה שגרתית מלאה.'}
                  </p>
                  {busInfo.lastTreatmentDate && (
                    <p className="text-[11px] text-emerald-700 pr-7">
                      טיפול קודם: {new Date(busInfo.lastTreatmentDate).toLocaleDateString('he-IL')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Next Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleProceedToCount}
              disabled={!busInfo || !busInfo.canStartTreatment}
              className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-black rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>המשך לבחירת מכשירים</span>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
        </div>
      )}

      {/* STEP 2: Device Count Selector */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <div className="inline-block px-3 py-1 bg-slate-100 text-slate-800 rounded-xl text-xs font-black mb-2 border border-slate-200">
              מפעיל: {operator}
            </div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-emerald-600" />
              <span>שלב 2: כמות מכשירים באוטובוס</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {operator === 'דן בדרום'
                ? 'באוטובוסי דן בדרום נדרש מכשיר 1 לבדיקה (או יותר)'
                : 'באוטובוסי דן באר שבע נדרשים לפחות 3 מכשירים לבדיקה'}
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center space-y-4">
            <div className="text-5xl font-black text-emerald-600 tracking-tight">
              {deviceCount}
            </div>
            <div className="text-sm font-bold text-slate-600">מכשירים לבדיקה בצ'ק-ליסט</div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeviceCount(prev => Math.max(operator === 'דן בדרום' ? 1 : 3, prev - 1))}
                className="w-12 h-12 rounded-xl bg-white border border-slate-300 text-2xl font-bold text-slate-700 hover:bg-slate-100 active:scale-95 shadow-sm"
              >
                -
              </button>

              <input
                type="range"
                min={operator === 'דן בדרום' ? 1 : 3}
                max={12}
                value={deviceCount}
                onChange={(e) => setDeviceCount(Number(e.target.value))}
                className="w-48 accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                onClick={() => setDeviceCount(prev => Math.min(12, prev + 1))}
                className="w-12 h-12 rounded-xl bg-white border border-slate-300 text-2xl font-bold text-slate-700 hover:bg-slate-100 active:scale-95 shadow-sm"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="py-3 px-5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ArrowRight className="w-5 h-5" />
              <span>חזור</span>
            </button>

            <button
              type="button"
              onClick={handleInitDevices}
              className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <span>התחל מילוי מכשירים</span>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Fill Devices Checklist One-by-One */}
      {step === 3 && devices[currentDeviceIndex] && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">צ'ק-ליסט מכשירים</span>
              <h2 className="text-xl font-black text-slate-900">
                מכשיר {currentDeviceIndex + 1} מתוך {deviceCount}
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 font-black flex items-center justify-center border border-emerald-200">
              #{currentDeviceIndex + 1}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                סוג מוצר / מכשיר <span className="text-rose-500">*</span>
              </label>
              {loadingProducts ? (
                <div className="text-sm text-slate-400">טוען קטלוג מוצרים...</div>
              ) : activeProducts.length === 0 ? (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-medium">
                  אין מוצרים פעילים במערכת. פנה למנהל המערכת.
                </div>
              ) : (
                <select
                  value={devices[currentDeviceIndex]?.productName || ''}
                  onChange={(e) => handleUpdateDevice('productName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {activeProducts.map(prod => (
                    <option key={prod.id} value={prod.name}>
                      {prod.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                מספר סידורי / מזהה מכשיר <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="הזן מספר סידורי או ברקוד"
                value={devices[currentDeviceIndex]?.serialNumber || ''}
                onChange={(e) => handleUpdateDevice('serialNumber', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                מצב המכשיר <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateDevice('status', 'תקין')}
                  className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                    devices[currentDeviceIndex]?.status === 'תקין'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>תקין</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateDevice('status', 'לא תקין')}
                  className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                    devices[currentDeviceIndex]?.status === 'לא תקין'
                      ? 'bg-rose-50 border-rose-600 text-rose-800 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <X className="w-5 h-5 text-rose-600" />
                  <span>לא תקין</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                הערה ייעודית למכשיר (אופציונלי)
              </label>
              <input
                type="text"
                placeholder="הערות לגבי מכשיר זה, מיקום, תקלה שזוהתה..."
                value={devices[currentDeviceIndex]?.notes || ''}
                onChange={(e) => handleUpdateDevice('notes', e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handlePrevDevice}
              className="py-3 px-4 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ArrowRight className="w-5 h-5" />
              <span>הקודם</span>
            </button>

            <button
              type="button"
              onClick={handleNextDevice}
              className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <span>{currentDeviceIndex < deviceCount - 1 ? 'למכשיר הבא' : 'המשך לסיכום הטיפול'}</span>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

        </div>
      )}

      {/* STEP 4: Summary & Decision */}
      {step === 4 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span>שלב 4: סיכום והחלטה</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">הזן סיכום טיפול ובחר את סטטוס הסגירה של האוטובוס</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              סיכום הטיפול והערות הטכנאי <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="פרט את פעולות הבדיקה שבוצעו, תקלות שנמצאו או תוקנו, והמלצות להמשך..."
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              החלטת סגירת טיפול <span className="text-rose-500">*</span>
            </label>

            <div className="space-y-3">
              <label
                onClick={() => setDecision('הכול תקין באוטובוס')}
                className={`cursor-pointer p-4 rounded-xl border-2 flex items-start gap-3 transition-all ${
                  decision === 'הכול תקין באוטובוס'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                  decision === 'הכול תקין באוטובוס' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                }`}>
                  {decision === 'הכול תקין באוטובוס' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-extrabold text-base">הכול תקין באוטובוס</div>
                  <div className="text-xs text-slate-500 mt-0.5">כל המכשירים נבדקו ונמצאו תקינים לשירות</div>
                </div>
              </label>

              <label
                onClick={() => setDecision('נדרש המשך טיפול של הלקוח')}
                className={`cursor-pointer p-4 rounded-xl border-2 flex items-start gap-3 transition-all ${
                  decision === 'נדרש המשך טיפול של הלקוח'
                    ? 'bg-rose-50 border-rose-600 text-rose-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                  decision === 'נדרש המשך טיפול של הלקוח' ? 'border-rose-600 bg-rose-600' : 'border-slate-300'
                }`}>
                  {decision === 'נדרש המשך טיפול של הלקוח' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-extrabold text-base text-rose-700">נדרש המשך טיפול של הלקוח</div>
                  <div className="text-xs text-slate-500 mt-0.5">האוטובוס יעבור לתור הניהולי להמשך טיפול על ידי מנהל/הלקוח</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setCurrentDeviceIndex(deviceCount - 1); setStep(3); }}
              className="py-3 px-4 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ArrowRight className="w-5 h-5" />
              <span>חזור למכשירים</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!summary.trim()) {
                  alert('נא להזין סיכום טיפול לפני המעבר לסקירה');
                  return;
                }
                setStep(5);
              }}
              className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <span>מעבר לסקירה סופית</span>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Review & Final Submit */}
      {step === 5 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600" />
              <span>שלב 5: סקירת הדוח לפני אישור</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">אנא ודא את נכונות כל הפרטים לפני שליחה סופית</p>
          </div>

          {submitError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
              ⚠️ {submitError}
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">מפעיל תחבורה:</span>
              <span className="text-sm font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">{operator}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">אוטובוס מספר:</span>
              <span className="text-lg font-black text-slate-900">{busNumber}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">החלטת סגירה:</span>
              <StatusBadge status={decision === 'הכול תקין באוטובוס' ? 'הטיפול הושלם' : 'הועבר להמשך טיפול'} />
            </div>

            {photoPreview && (
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-500 block mb-1">צילום שצורף / נסרק:</span>
                <img src={photoPreview} alt="תמונה שצורפה" className="w-28 h-20 object-cover rounded-lg border border-slate-300" />
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">מכשירי האוטובוס שנבדקו ({devices.length}):</h3>
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
                  {devices.map((dev, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-800">{dev.productName}</td>
                      <td className="p-2.5 font-mono text-slate-600" dir="ltr">{dev.serialNumber}</td>
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

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 block mb-1">סיכום הטכנאי:</span>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{summary}</p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(4)}
              className="py-3 px-4 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
            >
              <ArrowRight className="w-5 h-5" />
              <span>חזור לעריכה</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitReport}
              className="flex-1 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span className="inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Check className="w-6 h-6" />
                  <span>אישור ושמירת דוח סופי</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Success Confirmation */}
      {step === 6 && submittedReport && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">דוח הטיפול נשמר בהצלחה!</h2>
            <p className="text-sm text-slate-500 mt-1">
              מספר דוח: <strong>#{submittedReport.reportId}</strong> | אוטובוס: <strong>{submittedReport.busNumber}</strong>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 inline-block text-right text-xs space-y-2">
            <div><strong>סטטוס אוטובוס מעודכן:</strong> <StatusBadge status={submittedReport.status} /></div>
            <div><strong>תאריך ושעה:</strong> {new Date(submittedReport.createdAt).toLocaleString('he-IL')}</div>
          </div>

          <div>
            <button
              type="button"
              onClick={resetForm}
              className="py-3.5 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all inline-flex items-center gap-2"
            >
              <Bus className="w-5 h-5" />
              <span>פתח טיפול לאוטובוס נוסף</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
