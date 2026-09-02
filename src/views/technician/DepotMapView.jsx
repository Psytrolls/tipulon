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
  ExternalLink
} from 'lucide-react';

export default function DepotMapView({ onSelectBusForTreatment }) {
  const [loading, setLoading] = useState(true);
  const [hubs, setHubs] = useState([]);
  const [selectedHubId, setSelectedHubId] = useState('habonim_br7');
  const [operatorFilter, setOperatorFilter] = useState(''); // '' = all, 'דן באר שבע', 'דן בדרום'

  const fetchLiveDepots = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/buses/depots-live');
      if (res.ok) {
        const data = await res.json();
        setHubs(data.hubs || []);
        if (data.hubs?.length > 0 && !selectedHubId) {
          setSelectedHubId(data.hubs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load depots map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveDepots();
  }, []);

  const filteredHubs = hubs.filter(h => !operatorFilter || h.operator === operatorFilter);
  const selectedHub = hubs.find(h => h.id === selectedHubId) || filteredHubs[0] || null;

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
          onClick={fetchLiveDepots}
          disabled={loading}
          className="self-start sm:self-auto py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
          <span>רענן מפה בזמן אמת</span>
        </button>
      </div>

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
          const hasReady = hub.availableForTreatmentCount > 0;

          return (
            <div
              key={hub.id}
              onClick={() => setSelectedHubId(hub.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs space-y-3 ${
                isSelected
                  ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
                    <span>📍</span>
                    <span>{hub.shortName || hub.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-bold block">{hub.city}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  hub.operator === 'דן בדרום' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  {hub.operator}
                </span>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">עומדים כעת</span>
                  <span className="text-base font-black text-slate-800">{hub.totalParkedCount}</span>
                </div>

                <div className={`p-2 rounded-xl border ${
                  hasReady 
                    ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="text-[10px] font-bold block">זמינים לטיפול</span>
                  <span className="text-base font-black flex items-center justify-center gap-1">
                    {hasReady && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>}
                    <span>{hub.availableForTreatmentCount}</span>
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
      {selectedHub && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-5 animate-fadeIn">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📍</span>
                <h2 className="text-xl font-black text-slate-900">{selectedHub.name} ({selectedHub.city})</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                נמצאים כעת {selectedHub.totalParkedCount} אוטובוסים עומדים | <strong>{selectedHub.availableForTreatmentCount} זמינים לביצוע טיפול מונע</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={selectedHub.wazeUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Navigation className="w-4 h-4" />
                <span>נווט לחניון ב-Waze</span>
              </a>

              <a
                href={selectedHub.mapsUrl}
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
                  frameBorder="0"
                  scrolling="no"
                  marginHeight="0"
                  marginWidth="0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${(selectedHub.lon - 0.008).toFixed(6)},${(selectedHub.lat - 0.005).toFixed(6)},${(selectedHub.lon + 0.008).toFixed(6)},${(selectedHub.lat + 0.005).toFixed(6)}&layer=mapnik&marker=${selectedHub.lat.toFixed(6)},${selectedHub.lon.toFixed(6)}`}
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
                  {selectedHub.availableForTreatmentCount} זמינים
                </span>
              </div>

              {selectedHub.busesForTreatment.length === 0 ? (
                <div className="p-10 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">כל האוטובוסים בחניון זה מטופלים ובתוקף!</p>
                  <p className="text-[11px] text-slate-400">אין כרגע אוטובוסים הדורשים טיפול מונע במתחם זה.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {selectedHub.busesForTreatment.map((b) => (
                    <div
                      key={b.bus_number}
                      className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm font-mono">{b.bus_number}</span>
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
      )}

    </div>
  );
}
