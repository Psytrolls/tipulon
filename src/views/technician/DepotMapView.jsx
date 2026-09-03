import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  RefreshCw, 
  Bus, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Sparkles,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

const INITIAL_HUBS = [
  { id: 'habonim_parking', name: 'חניון רכב כבד (הבונים)', shortName: 'חניון רכב כבד', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.22220, lon: 34.80640, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2222,34.8064&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2222,34.8064' },
  { id: 'habonim_garage', name: 'מוסך דן (עמק שרה)', shortName: 'מוסך דן (אין כניסה)', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.22220, lon: 34.80880, isRestricted: true, type: 'GARAGE', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2222,34.8088&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2222,34.8088' },
  { id: 'merkazit_br7', name: 'תחנה מרכזית (רציפים וחניון)', shortName: 'תחנה מרכזית', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.24128, lon: 34.79799, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.24128,34.79799&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.24128,34.79799' },
  { id: 'hatzerim_br7', name: 'מסוף חצרים', shortName: 'מסוף חצרים', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.24241, lon: 34.75188, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.24241,34.75188&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.24241,34.75188' },
  { id: 'rakevet_tzafon_br7', name: 'מסוף רכבת צפון (אוניברסיטה)', shortName: 'רכבת צפון', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.26090, lon: 34.76390, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2609,34.7639&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2609,34.7639' },
  { id: 'turner_br7', name: 'מסוף אצטדיון טרנר', shortName: 'אצטדיון טרנר', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.27250, lon: 34.78120, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2725,34.7812&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2725,34.7812' },
  { id: 'ramot_br7', name: 'מסוף רמות', shortName: 'מסוף רמות', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.26350, lon: 34.81080, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2635,34.8108&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2635,34.8108' },
  { id: 'big_br7', name: 'מסוף ביג (המשק)', shortName: 'מסוף ביג', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.23840, lon: 34.81150, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2384,34.8115&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2384,34.8115' },
  { id: 'masof_ya_br7', name: 'מסוף י"א', shortName: 'מסוף י"א', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.25240, lon: 34.76960, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2524,34.7696&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2524,34.7696' },
  { id: 'beit_almin_br7', name: 'מסוף בית עלמין', shortName: 'בית עלמין', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.22080, lon: 34.82300, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.2208,34.823&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.2208,34.823' },
  { id: 'eldan_ashkelon', name: 'חניון אלדן (פארק צפוני)', shortName: 'חניון אלדן', city: 'אשקלון', operator: 'דן בדרום', lat: 31.67319, lon: 34.60244, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.67319,34.60244&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.67319,34.60244' },
  { id: 'merkazit_ashkelon', name: 'תחנה מרכזית (מסוף רמז)', shortName: 'תחנה מרכזית אשקלון', city: 'אשקלון', operator: 'דן בדרום', lat: 31.66440, lon: 34.56680, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.6644,34.5668&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.6644,34.5668' },
  { id: 'ashdod_depot', name: 'חניון ומסוף עד הלום (אשדוד)', shortName: 'עד הלום אשדוד', city: 'אשדוד', operator: 'דן בדרום', lat: 31.78000, lon: 34.66520, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.78,34.6652&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.78,34.6652' },
  { id: 'malakhi_depot', name: 'תחנה מרכזית קרית מלאכי', shortName: 'קרית מלאכי', city: 'קרית מלאכי', operator: 'דן בדרום', lat: 31.73023, lon: 34.75344, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.73023,34.75344&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.73023,34.75344' },
  { id: 'ofakim_depot', name: 'חניון ומסוף אופקים', shortName: 'חניון אופקים', city: 'אופקים', operator: 'דן בדרום', lat: 31.32160, lon: 34.62340, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.3216,34.6234&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.3216,34.6234' },
  { id: 'netivot_depot', name: 'חניון ומסוף נתיבות', shortName: 'חניון נתיבות', city: 'נתיבות', operator: 'דן בדרום', lat: 31.41128, lon: 34.58334, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.41128,34.58334&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.41128,34.58334' },
  { id: 'sderot_depot', name: 'חניון ומסוף שדרות', shortName: 'חניון שדרות', city: 'שדרות', operator: 'דן בדרום', lat: 31.52200, lon: 34.60350, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.522,34.6035&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.522,34.6035' },
  { id: 'kiryat_gat', name: 'חניון ומסוף קרית גת', shortName: 'חניון קרית גת', city: 'קרית גת', operator: 'דן בדרום', lat: 31.60900, lon: 34.77040, isRestricted: false, type: 'PARKING', totalParkedCount: 0, availableForTreatmentCount: 0, busesForTreatment: [], wazeUrl: 'https://waze.com/ul?ll=31.609,34.7704&navigate=yes', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.609,34.7704' }
];

export default function DepotMapView({ onSelectBusForTreatment }) {
  const [loading, setLoading] = useState(true);
  const [hubs, setHubs] = useState(INITIAL_HUBS);
  const [selectedHubId, setSelectedHubId] = useState('habonim_parking');
  const [operatorFilter, setOperatorFilter] = useState(''); // '' = all, 'דן באר שבע', 'דן בדרום'
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchLiveDepots = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/buses/depots-live');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.hubs) && data.hubs.length > 0) {
          setHubs(data.hubs);
        }
      } else {
        setErrorMsg('לא ניתן לקבל נתונים עדכניים כעת מהשרת');
      }
    } catch (err) {
      console.error('Failed to load depots map data:', err);
      setErrorMsg('שגיאת תקשורת בטעינת נתוני מפה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveDepots();
  }, []);

  const safeHubs = Array.isArray(hubs) && hubs.length > 0 ? hubs : INITIAL_HUBS;
  const filteredHubs = safeHubs.filter(h => !operatorFilter || h.operator === operatorFilter);
  const selectedHub = filteredHubs.find(h => h.id === selectedHubId) || filteredHubs[0] || safeHubs[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <MapPin className="w-6 h-6" />
            </span>
            <span>מפת חניונים ואוטובוסים זמינים לטיפול</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            איתור בזמן אמת של חניונים ומתחמים שבהם עומדים אוטובוסים הממתינים לטיפול מונע
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLiveDepots}
          disabled={loading}
          className="self-start sm:self-auto py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'סורק לוויין בזמן אמת...' : 'רענן מפה בזמן אמת'}</span>
        </button>
      </div>

      {/* Loading Banner */}
      {loading && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin flex-shrink-0" />
          <span className="text-xs font-bold text-emerald-900">
            סורק כעת מיקומי GPS בזמן אמת של 18 מסופים וחניונים בדרום...
          </span>
        </div>
      )}

      {/* Error Message if any */}
      {errorMsg && !loading && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="text-xs font-bold text-rose-900">{errorMsg}</span>
        </div>
      )}

      {/* Operator Filter Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl w-full sm:w-max">
        <button
          type="button"
          onClick={() => setOperatorFilter('')}
          className={`py-2 px-4 rounded-xl text-xs font-black transition-all ${
            !operatorFilter ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          כל החניונים ({hubs.length})
        </button>
        <button
          type="button"
          onClick={() => setOperatorFilter('דן באר שבע')}
          className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            operatorFilter === 'דן באר שבע' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>דן באר שבע</span>
        </button>
        <button
          type="button"
          onClick={() => setOperatorFilter('דן בדרום')}
          className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            operatorFilter === 'דן בדרום' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          <span>דן בדרום</span>
        </button>
      </div>

      {/* Hubs Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredHubs.map((hub) => {
          const isSelected = selectedHub?.id === hub.id;
          const isRestricted = Boolean(hub.isRestricted || hub.type === 'GARAGE');

          return (
            <div
              key={hub.id}
              onClick={() => setSelectedHubId(hub.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs space-y-3 ${
                isSelected
                  ? isRestricted
                    ? 'bg-rose-50/90 border-rose-500 ring-2 ring-rose-500'
                    : 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500'
                  : isRestricted
                  ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
                    <span>{isRestricted ? '🔧' : '📍'}</span>
                    <span>{hub.shortName || hub.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-bold block">{hub.city}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    hub.operator === 'דן בדרום' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    {hub.operator}
                  </span>
                  {isRestricted && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                      🚫 שטח סגור
                    </span>
                  )}
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className={`p-2 rounded-xl border ${isRestricted ? 'bg-rose-100/50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] text-slate-400 font-bold block">עומדים כעת</span>
                  <span className={`text-base font-black ${isRestricted ? 'text-rose-900' : 'text-slate-800'}`}>{hub.totalParkedCount}</span>
                </div>

                <div className={`p-2 rounded-xl border ${
                  isRestricted
                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                    : hasReady 
                    ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="text-[10px] font-bold block">זמינים לטיפול</span>
                  <span className="text-base font-black flex items-center justify-center gap-1">
                    {!isRestricted && hasReady && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>}
                    <span>{isRestricted ? '0 (נעול)' : hub.availableForTreatmentCount}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <a
                  href={hub.wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg border border-blue-200 text-center flex items-center justify-center gap-1 transition-colors"
                >
                  <Navigation className="w-3 h-3 text-blue-600" />
                  <span>Waze</span>
                </a>
                <a
                  href={hub.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-black rounded-lg border border-slate-200 text-center flex items-center justify-center gap-1 transition-colors"
                >
                  <MapPin className="w-3 h-3 text-rose-500" />
                  <span>Maps</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Hub Detail Section */}
      {selectedHub && (() => {
        const hubLat = Number(selectedHub?.lat) || 31.2222;
        const hubLon = Number(selectedHub?.lon) || 34.8064;
        const hubName = selectedHub?.name || 'חניון';
        const hubCity = selectedHub?.city || '';
        const isRestricted = Boolean(selectedHub?.isRestricted || selectedHub?.type === 'GARAGE');
        const totalParked = selectedHub?.totalParkedCount || 0;
        const availableCount = isRestricted ? 0 : (selectedHub?.availableForTreatmentCount || 0);
        const busesList = Array.isArray(selectedHub?.busesForTreatment) ? selectedHub.busesForTreatment : [];
        const waze = selectedHub?.wazeUrl || `https://waze.com/ul?ll=${hubLat},${hubLon}&navigate=yes`;
        const gmaps = selectedHub?.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${hubLat},${hubLon}`;

        return (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-5 animate-fadeIn">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{isRestricted ? '🔧' : '📍'}</span>
                  <h2 className="text-xl font-black text-slate-900">{hubName} {hubCity ? `(${hubCity})` : ''}</h2>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isRestricted ? (
                    <span className="text-rose-600 font-black">
                      ⛔ שטח מוסך סגור: נמצאים כעת {totalParked} אוטובוסים בתיקונים/טיפולים בתוך המוסך. אין כניסת טכנאי כרטוס!
                    </span>
                  ) : (
                    <>נמצאים כעת {totalParked} אוטובוסים עומדים | <strong>{availableCount} זמינים לביצוע טיפול מונע</strong></>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={waze}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  <span>נווט לחניון ב-Waze</span>
                </a>

                <a
                  href={gmaps}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>Google Maps</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Embedded Live Map for the Selected Hub */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span>🗺️</span>
                  <span>מפת מיקום החניון והמתחם:</span>
                </span>
                <div className="rounded-2xl overflow-hidden border border-slate-300 shadow-inner h-72">
                  <iframe
                    title="Hub Map"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${(hubLon - 0.008).toFixed(6)},${(hubLat - 0.005).toFixed(6)},${(hubLon + 0.008).toFixed(6)},${(hubLat + 0.005).toFixed(6)}&layer=mapnik&marker=${hubLat.toFixed(6)},${hubLon.toFixed(6)}`}
                    className="w-full h-full border-0"
                  />
                </div>
              </div>

              {/* List of Buses Ready for Treatment in This Hub */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>אוטובוסים זמינים לטיפול כעת בחניון זה:</span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {availableCount} זמינים
                  </span>
                </div>

                {isRestricted ? (
                  <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
                    <span className="text-3xl block">🚫</span>
                    <p className="text-sm font-black text-rose-900">מתחם מוסך דן – שטח סגור לטכנאי כרטוס</p>
                    <p className="text-xs text-rose-700 font-medium max-w-sm mx-auto leading-relaxed">
                      האוטובוסים במתחם זה נמצאים בטיפולים מכניים בתוך מבנה המוסך. אין כניסה לטכנאים ללא אישור ותיאום מנהל המוסך.
                    </p>
                  </div>
                ) : busesList.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">כל האוטובוסים בחניון זה מטופלים ובתוקף!</p>
                    <p className="text-[11px] text-slate-400">אין כרגע אוטובוסים הדורשים טיפול מונע במתחם זה.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {busesList.map((b) => (
                      <div
                        key={b.bus_number}
                        className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm font-mono">{b.bus_number}</span>
                            {b.statusHint && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-900 border border-emerald-300">
                                {b.statusHint}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {b.last_treatment_date ? `טיפול קודם: ${new Date(b.last_treatment_date).toLocaleDateString('he-IL')}` : 'טרם בוצע טיפול ראשון'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectBusForTreatment && onSelectBusForTreatment(b.bus_number)}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                        >
                          <span>התחל טיפול</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        );
      })()}

    </div>
  );
}
