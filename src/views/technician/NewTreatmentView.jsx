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
  RefreshCw,
  MapPin,
  Navigation,
  Radio,
  Calendar
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { validateBusNumber, validateDeviceSerialNumber } from '../../utils/validators';

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

  // Autocomplete suggestions
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const cameraInputRef = useRef(null);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

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

  // Autocomplete when typing 2 to 6 digits (short number or suffix)
  useEffect(() => {
    const clean = busNumber.replace(/[^0-9]/g, '').trim();
    if (clean.length >= 2 && clean.length <= 6) {
      const timer = setTimeout(async () => {
        try {
          setLoadingSuggestions(true);
          const res = await fetch(`/api/buses/autocomplete?q=${encodeURIComponent(clean)}&operator=${encodeURIComponent(operator)}`);
          if (res.ok) {
            const data = await res.json();
            setAutocompleteSuggestions(data.matches || []);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingSuggestions(false);
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setAutocompleteSuggestions([]);
    }
  }, [busNumber, operator]);

  // Handle manual or autocompleted bus lookup
  const handleSearchBus = async (numberToSearch = null) => {
    const targetNumber = (numberToSearch || busNumber).replace(/[^0-9]/g, '').trim();
    if (!targetNumber) {
      setBusError('נא להזין מספר אוטובוס או מספר קצר');
      return;
    }

    // If short number entered (< 7 digits), resolve automatically
    if (targetNumber.length < 7) {
      setSearchingBus(true);
      setBusError('');
      try {
        const autoRes = await fetch(`/api/buses/autocomplete?q=${encodeURIComponent(targetNumber)}&operator=${encodeURIComponent(operator)}`);
        const autoData = await autoRes.json();
        const matches = autoData.matches || [];

        if (matches.length === 1) {
          // Exactly 1 match found! Auto-fill full number
          const resolvedBusNumber = matches[0].bus_number;
          setBusNumber(resolvedBusNumber);
          setAutocompleteSuggestions([]);
          return handleSearchBus(resolvedBusNumber);
        } else if (matches.length > 1) {
          setAutocompleteSuggestions(matches);
          setBusError(`נמצאו ${matches.length} אוטובוסים עם מספר זה. בחר את האוטובוס המתאים למטה:`);
          setSearchingBus(false);
          return;
        } else {
          setBusError(`לא נמצא אוטובוס עם מספר קצר "${targetNumber}". נסה להזין מספר רישוי מלא.`);
          setSearchingBus(false);
          return;
        }
      } catch (e) {
        setBusError('שגיאה באיתור מספר קצר');
        setSearchingBus(false);
        return;
      }
    }

    const validationErr = validateBusNumber(targetNumber);
    if (validationErr) {
      setBusError(validationErr);
      return;
    }

    setSearchingBus(true);
    setBusError('');
    setBusInfo(null);
    setAutocompleteSuggestions([]);

    try {
      const res = await fetch(`/api/buses/search/${encodeURIComponent(targetNumber)}?operator=${encodeURIComponent(operator)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה באיתור אוטובוס');
      }
      setBusInfo(data);
      setBusNumber(targetNumber);
      if (data.operator && data.operator !== operator) {
        setOperator(data.operator);
      }
    } catch (err) {
      setBusError(err.message);
    } finally {
      setSearchingBus(false);
    }
  };

  // Fast client-side resize to 1200px before upload (speeds up scan from 20s to ~1s!)
  const compressImageClientSide = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name || 'plate.jpg', { type: 'image/jpeg' });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  // Handle Photo Capture + Automatic OCR Recognition
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    setPhotoError('');
    setOcrSuccessMsg('');
    if (!file) return;

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
      // Compress client side: shrinks 10MB phone camera photo to ~100KB for instant response
      const uploadFile = await compressImageClientSide(file);

      const formData = new FormData();
      formData.append('photo', uploadFile);

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
    // Find PCE 415 and VPE 420 in catalog
    const pce415 = activeProducts.find(p => p.name.toLowerCase().includes('415')) || activeProducts[0];
    const vpe420 = activeProducts.find(p => p.name.toLowerCase().includes('420')) || activeProducts[1] || activeProducts[0];

    const initialDevices = [];
    for (let i = 0; i < deviceCount; i++) {
      // First device defaults to PCE 415, all subsequent devices default to VPE 420
      const defaultProd = (i === 0) ? (pce415 || { name: 'PCE 415', id: null }) : (vpe420 || { name: 'VPE 420', id: null });
      initialDevices.push(
        devices[i] || {
          productName: defaultProd?.name || 'VPE 420',
          productId: defaultProd?.id || null,
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

  // Update specific device in state with smart cascade
  const handleUpdateDevice = (field, value) => {
    const updated = [...devices];
    if (field === 'productName') {
      const found = activeProducts.find(p => p.name.toLowerCase() === String(value).toLowerCase()) ||
                    activeProducts.find(p => p.name.toLowerCase().includes(String(value).toLowerCase().replace(/\s+/g, '')));
      
      const realProductName = found?.name || value;
      const realProductId = found?.id || null;

      updated[currentDeviceIndex] = {
        ...updated[currentDeviceIndex],
        productName: realProductName,
        productId: realProductId
      };

      // Smart device cascade:
      // If PCE 415 is chosen -> all subsequent devices default to VPE 420
      // If VPE 430 is chosen -> all subsequent devices default to VPE 430
      // If VPE 420 is chosen -> all subsequent devices default to VPE 420
      const valLower = String(value).toLowerCase();
      let cascadeTargetName = null;

      if (valLower.includes('415')) {
        const target = activeProducts.find(p => p.name.toLowerCase().includes('420'));
        cascadeTargetName = target ? target.name : 'VPE 420';
      } else if (valLower.includes('430')) {
        const target = activeProducts.find(p => p.name.toLowerCase().includes('430'));
        cascadeTargetName = target ? target.name : 'VPE 430';
      } else if (valLower.includes('420')) {
        const target = activeProducts.find(p => p.name.toLowerCase().includes('420'));
        cascadeTargetName = target ? target.name : 'VPE 420';
      }

      if (cascadeTargetName) {
        const cascadeProd = activeProducts.find(p => p.name === cascadeTargetName);
        for (let i = currentDeviceIndex + 1; i < updated.length; i++) {
          updated[i] = {
            ...updated[i],
            productName: cascadeTargetName,
            productId: cascadeProd?.id || null
          };
        }
      }
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
    if (validateDeviceSerialNumber(current.serialNumber)) return false;
    if (!current.status) return false;
    return true;
  };

  const handleNextDevice = () => {
    const current = devices[currentDeviceIndex];
    if (!current?.productName) {
      alert('חובה לבחור סוג מוצר');
      return;
    }
    const serialErr = validateDeviceSerialNumber(current?.serialNumber);
    if (serialErr) {
      alert(serialErr);
      return;
    }
    if (!current?.status) {
      alert('חובה לבחור מצב מכשיר (תקין / לא תקין)');
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
    const busErr = validateBusNumber(busNumber);
    if (busErr) {
      setSubmitError(busErr);
      return;
    }

    for (let i = 0; i < devices.length; i++) {
      const serialErr = validateDeviceSerialNumber(devices[i]?.serialNumber);
      if (serialErr) {
        setSubmitError(`מכשיר #${i + 1}: ${serialErr}`);
        return;
      }
    }

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

          {/* Bus Number Input (Short or Full) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-700">מספר אוטובוס (מלא או מספר קצר)</label>
              <span className="text-[11px] font-bold text-slate-400">קצר (3-4) או מלא (7-8)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={busNumber}
                onChange={(e) => setBusNumber(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchBus()}
                placeholder="הזן מספר קצר (לדוגמה 1687) או מספר רישוי מלא"
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-lg font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left tracking-wider"
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
            <span className="text-[11px] text-slate-400 block font-medium">
              💡 הזן מספר קצר (3–4 ספרות) והמערכת תשלים אוטומטית, או הקלד מספר רישוי מלא (7–8 ספרות).
            </span>

            {/* Autocomplete Suggestions Chips */}
            {autocompleteSuggestions.length > 0 && (
              <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1.5 animate-fadeIn">
                <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>אוטובוסים שנמצאו לפי מספר זה (לחץ לבחירה מיידית):</span>
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {autocompleteSuggestions.map((m) => (
                    <button
                      key={m.bus_number}
                      type="button"
                      onClick={() => handleSearchBus(m.bus_number)}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white text-slate-800 border border-emerald-300 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <span>{m.bus_number}</span>
                      {m.short_number && m.short_number !== m.bus_number && (
                        <span className="text-[10px] opacity-75 font-normal">({m.short_number})</span>
                      )}
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded font-bold">
                        {m.operator}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {busError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 animate-shake">
                <span>⚠️</span>
                <span>{busError}</span>
              </div>
            )}
          </div>

          {/* Bus Check Result Banner */}
          {busInfo && (
            <div className="p-5 rounded-2xl border transition-all space-y-4 bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-black text-slate-900 block">
                    אוטובוס {busInfo.busNumber}
                    {busInfo.shortNumber && busInfo.shortNumber !== busInfo.busNumber && (
                      <span className="mr-1.5 text-xs font-bold text-slate-500">(מספר קצר: {busInfo.shortNumber})</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{busInfo.operator}</span>
                </div>
                <StatusBadge status={busInfo.status} />
              </div>

              {/* Live Dispatch & Location Card from Ops System */}
              {busInfo.liveDispatch && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-black text-slate-800">מיקום וסידור עבודה חי:</span>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                      busInfo.liveDispatch.isParked 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {busInfo.liveDispatch.isParked ? '🟢 בחניון / פנוי לטיפול' : '🟡 בנסיעה פעילה בקו'}
                    </span>
                  </div>

                  {/* Smart Layover & Time Window Verdict */}
                  {busInfo.liveDispatch.timeVerdictText && (
                    <div className={`p-3 rounded-xl border text-xs font-black flex items-start gap-2 ${
                      busInfo.liveDispatch.timeBadgeType === 'DANGER'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : busInfo.liveDispatch.timeBadgeType === 'WARNING'
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}>
                      <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <div>{busInfo.liveDispatch.timeVerdictText}</div>
                        {busInfo.liveDispatch.timeBadgeType === 'DANGER' && (
                          <div className="text-[11px] font-semibold text-rose-600 mt-0.5">
                            טיפול מונע דורש 15–30 דקות לפחות. מומלץ להמתין למשמרת הבאה או לבחור אוטובוס אחר!
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location, GPS Telemetry & Interactive Map */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800">
                          {busInfo.liveDispatch.hasGps ? '📡 מיקום GPS לוויני בזמן אמת:' : 'מיקום / תחנת יעד:'}
                        </span>
                        {busInfo.liveDispatch.hasGps && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {busInfo.liveDispatch.mapsUrl && (
                          <a
                            href={busInfo.liveDispatch.mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[10px] font-black flex items-center gap-1 shadow-xs transition-all active:scale-95"
                          >
                            <MapPin className="w-3 h-3 text-rose-500" />
                            <span>Google Maps</span>
                          </a>
                        )}
                        {busInfo.liveDispatch.wazeUrl && (
                          <a
                            href={busInfo.liveDispatch.wazeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[10px] font-black flex items-center gap-1 shadow-xs transition-all active:scale-95"
                          >
                            <Navigation className="w-3 h-3 text-blue-600" />
                            <span>Waze</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* GPS Telemetry Pills (Speed, Heading, Coordinates) */}
                    {busInfo.liveDispatch.hasGps && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                          {busInfo.liveDispatch.speed > 0 
                            ? `⚡ מהירות: ${busInfo.liveDispatch.speed} קמ"ש` 
                            : '🅿️ עומד במקום (0 קמ"ש)'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                          📍 {busInfo.liveDispatch.lat?.toFixed(4)}, {busInfo.liveDispatch.lon?.toFixed(4)}
                        </span>
                        {busInfo.liveDispatch.heading !== null && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                            🧭 כיוון: {busInfo.liveDispatch.heading}°
                          </span>
                        )}
                      </div>
                    )}

                    {/* Destination / Station Link */}
                    <a
                      href={busInfo.liveDispatch.mapsUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 transition-colors shadow-xs"
                      title="לחץ לפתיחה ישירה במפה"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📍</span>
                        <span className="font-black text-slate-900 text-xs group-hover:text-emerald-700">
                          {busInfo.liveDispatch.targetStation || busInfo.liveDispatch.location || busInfo.cluster || 'חניון מרכזי'}
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-600 font-bold group-hover:underline flex items-center gap-0.5">
                        <span>נווט במפה</span>
                        <span>←</span>
                      </span>
                    </a>

                    {/* Interactive Map Toggle & Embed */}
                    {busInfo.liveDispatch.embedMapUrl && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowLiveMap(!showLiveMap)}
                          className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>🗺️</span>
                          <span>{showLiveMap ? 'הסתר מפת לוויין' : 'הצג מיקום חי על גבי מפה'}</span>
                        </button>

                        {showLiveMap && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-slate-300 shadow-sm animate-fadeIn">
                            <iframe
                              title="Live Bus GPS Map"
                              width="100%"
                              height="210"
                              frameBorder="0"
                              scrolling="no"
                              marginHeight="0"
                              marginWidth="0"
                              src={busInfo.liveDispatch.embedMapUrl}
                              className="w-full h-52 border-0"
                            />
                            <div className="p-1.5 bg-slate-100 text-center text-[10px] text-slate-500 font-medium">
                              נקודת ה-GPS עודכנה ישירות ממחשב הרכב (Dan Telemetry System)
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {busInfo.liveDispatch.lineDescription && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>פירוט משימה נוכחית:</span>
                        {busInfo.liveDispatch.timeRange && (
                          <span className="font-mono text-slate-700 font-bold">{busInfo.liveDispatch.timeRange}</span>
                        )}
                      </div>
                      <div className="font-bold text-slate-800">{busInfo.liveDispatch.lineDescription}</div>
                    </div>
                  )}

                  {/* Full Daily Schedule Button & Timeline */}
                  {busInfo.liveDispatch.schedule && busInfo.liveDispatch.schedule.length > 0 && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setShowSchedule(!showSchedule)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-black flex items-center justify-between transition-all active:scale-[0.99] shadow-xs"
                      >
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-700" />
                          <span>לוח סידור עבודה יומי מלא ({busInfo.liveDispatch.schedule.length} משימות)</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                          {showSchedule ? 'הסתר לוח זמנים ▲' : 'הצג לוח זמנים ▼'}
                        </span>
                      </button>

                      {showSchedule && (
                        <div className="mt-2.5 space-y-2 animate-fadeIn bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="text-[11px] font-black text-slate-500 mb-1 px-1">
                            סידור עבודה מפורט מהמחשב המרכזי של דן:
                          </div>
                          {busInfo.liveDispatch.schedule.map((task, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border text-xs transition-all ${
                                task.isCurrent
                                  ? 'bg-amber-50 border-amber-400 shadow-xs ring-1 ring-amber-300'
                                  : task.statusCode === '4'
                                  ? 'bg-white border-slate-200 opacity-75'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                                    {task.startTime} - {task.endTime}
                                  </span>
                                  {task.isCurrent && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black animate-pulse">
                                      פעיל כעת ⚡
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  task.statusCode === '4'
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : task.statusCode === '3'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {task.statusText}
                                </span>
                              </div>
                              <div className="font-bold text-slate-900 text-xs">
                                {task.description}
                              </div>
                              {task.accName && (
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  סיווג: {task.accName}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-slate-700">
                  דגם המכשיר <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  בחירה חכמה
                </span>
              </div>

              {/* Quick Select Big Buttons for the 3 Devices */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {['PCE 415', 'VPE 420', 'VPE 430'].map((modelName) => {
                  const currentName = devices[currentDeviceIndex]?.productName || '';
                  const isSelected = currentName.toLowerCase().includes(modelName.toLowerCase().replace(/\s+/g, '')) ||
                                     currentName.toLowerCase() === modelName.toLowerCase();
                  return (
                    <button
                      key={modelName}
                      type="button"
                      onClick={() => handleUpdateDevice('productName', modelName)}
                      className={`py-3 px-2 rounded-xl font-black text-sm border-2 transition-all text-center shadow-sm active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {modelName}
                    </button>
                  );
                })}
              </div>

              {/* Also dropdown if there are other products in catalog */}
              {activeProducts.some(p => !['PCE 415', 'VPE 420', 'VPE 430'].some(m => p.name.toLowerCase().includes(m.toLowerCase().replace(/\s+/g, '')))) && (
                <select
                  value={devices[currentDeviceIndex]?.productName || ''}
                  onChange={(e) => handleUpdateDevice('productName', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-medium text-xs focus:bg-white focus:outline-none"
                >
                  <option value="">דגמים נוספים...</option>
                  {activeProducts.map(prod => (
                    <option key={prod.id} value={prod.name}>
                      {prod.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-slate-700">
                  מספר מכשיר <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-bold text-slate-400">3 עד 4 ספרות</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="לדוגמה: 123 או 1234"
                value={devices[currentDeviceIndex]?.serialNumber || ''}
                onChange={(e) => handleUpdateDevice('serialNumber', e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left tracking-wider text-base"
                dir="ltr"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">חובה 3 עד 4 ספרות (אסור להזין רק אפסים כגון 000)</span>
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
            <div><strong>תאריך ביצוע:</strong> {new Date(submittedReport.createdAt).toLocaleDateString('he-IL')}</div>
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
