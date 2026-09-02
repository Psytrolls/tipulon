import { db } from '../db.js';

export const HUBS = [
  { 
    id: 'habonim_br7', 
    name: 'חניון הבונים (עמק שרה)', 
    shortName: 'חניון הבונים',
    city: 'באר שבע', 
    operator: 'דן באר שבע', 
    lat: 31.22166, 
    lon: 34.80662
  },
  { 
    id: 'merkazit_br7', 
    name: 'תחנה מרכזית באר שבע', 
    shortName: 'תחנה מרכזית',
    city: 'באר שבע', 
    operator: 'דן באר שבע', 
    lat: 31.24128, 
    lon: 34.79799
  },
  { 
    id: 'hatzerim_br7', 
    name: 'מסוף חצרים', 
    shortName: 'מסוף חצרים',
    city: 'באר שבע', 
    operator: 'דן באר שבע', 
    lat: 31.24241, 
    lon: 34.75188
  },
  { 
    id: 'eldan_ashkelon', 
    name: 'חניון אלדן (פארק צפוני)', 
    shortName: 'חניון אלדן',
    city: 'אשקלון', 
    operator: 'דן בדרום', 
    lat: 31.67319, 
    lon: 34.60244
  },
  { 
    id: 'remez_ashkelon', 
    name: 'מסוף רמז', 
    shortName: 'מסוף רמז',
    city: 'אשקלון', 
    operator: 'דן בדרום', 
    lat: 31.66422, 
    lon: 34.56642
  },
  { 
    id: 'ashdod_depot', 
    name: 'חניון ומסוף אשדוד', 
    shortName: 'חניון אשדוד',
    city: 'אשדוד', 
    operator: 'דן בדרום', 
    lat: 31.82640, 
    lon: 34.66194
  },
  { 
    id: 'malakhi_depot', 
    name: 'תחנה מרכזית קרית מלאכי', 
    shortName: 'קרית מלאכי',
    city: 'קרית מלאכי', 
    operator: 'דן בדרום', 
    lat: 31.73023, 
    lon: 34.75344
  },
  { 
    id: 'netivot_depot', 
    name: 'חניון ומסוף נתיבות', 
    shortName: 'חניון נתיבות',
    city: 'נתיבות', 
    operator: 'דן בדרום', 
    lat: 31.31684, 
    lon: 34.62841
  },
  { 
    id: 'sderot_depot', 
    name: 'חניון ומסוף שדרות', 
    shortName: 'חניון שדרות',
    city: 'שדרות', 
    operator: 'דן בדרום', 
    lat: 31.41128, 
    lon: 34.58334
  },
  { 
    id: 'ofakim_depot', 
    name: 'חניון אופקים', 
    shortName: 'חניון אופקים',
    city: 'אופקים', 
    operator: 'דן בדרום', 
    lat: 31.52392, 
    lon: 34.60257
  },
  { 
    id: 'kiryat_gat', 
    name: 'חניון ומסוף קרית גת', 
    shortName: 'חניון קרית גת',
    city: 'קרית גת', 
    operator: 'דן בדרום', 
    lat: 31.58918, 
    lon: 34.78071
  }
];

let cachedSnapshot = null;
let lastSnapshotTime = 0;
const SNAPSHOT_TTL = 30 * 1000; // 30 seconds cache

/**
 * Returns strictly GPS-verified status of all depots, parked buses, and buses requiring maintenance
 */
export async function getLiveDepotsSnapshot() {
  const now = Date.now();
  if (cachedSnapshot && (now - lastSnapshotTime < SNAPSHOT_TTL)) {
    return cachedSnapshot;
  }

  // 1. Get all buses from DB
  const allBuses = db.prepare(`
    SELECT bus_number, operator, cluster, last_known_location,
           next_treatment_date, last_treatment_date
    FROM buses
  `).all();

  const busMap = new Map();
  allBuses.forEach(b => busMap.set(b.bus_number, b));

  // 2. Fetch live GPS telemetry from Dan's ops server
  // Sample across both operators
  const daromBuses = allBuses.filter(b => b.operator === 'דן בדרום').slice(0, 180);
  const br7Buses = allBuses.filter(b => b.operator === 'דן באר שבע').slice(0, 120);
  const sampleBuses = [...daromBuses, ...br7Buses];

  const busLocations = [];

  // Batch query GPS in chunks of 20
  for (let i = 0; i < sampleBuses.length; i += 20) {
    const chunk = sampleBuses.slice(i, i + 20);
    await Promise.all(chunk.map(async (b) => {
      const opId = b.operator === 'דן בדרום' ? 31 : 32;
      try {
        const url = `https://ops.dandarom.co.il/src/symcotech/sym_pos.php?operatorId=${opId}&car_number=${b.bus_number}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && data[0].Lat && data[0].Lon) {
            const lat = parseFloat(data[0].Lat);
            const lon = parseFloat(data[0].Lon);
            const speed = parseInt(data[0].Speed || 0);
            if (lat > 30 && lon > 34) {
              busLocations.push({
                bus_number: b.bus_number,
                operator: b.operator,
                lat,
                lon,
                speed,
                isParked: speed === 0,
                next_treatment_date: b.next_treatment_date,
                last_treatment_date: b.last_treatment_date
              });
            }
          }
        }
      } catch (e) {}
    }));
  }

  // 3. Match buses to hubs ONLY BY EXACT GPS PROXIMITY (~700m radius)
  const hubsResult = HUBS.map((hub) => {
    // Proximity matching: within ~0.007 degrees (~700 meters)
    const busesAtHub = busLocations.filter(b => 
      Math.abs(b.lat - hub.lat) < 0.007 && Math.abs(b.lon - hub.lon) < 0.007
    );

    const parkedBuses = busesAtHub.filter(b => b.isParked);

    const busesForTreatment = parkedBuses.filter(b => 
      !b.next_treatment_date || new Date(b.next_treatment_date) <= new Date()
    );

    return {
      id: hub.id,
      name: hub.name,
      shortName: hub.shortName,
      city: hub.city,
      operator: hub.operator,
      lat: hub.lat,
      lon: hub.lon,
      totalParkedCount: parkedBuses.length,
      availableForTreatmentCount: busesForTreatment.length,
      busesForTreatment: busesForTreatment.map(b => ({
        bus_number: b.bus_number,
        operator: b.operator,
        last_treatment_date: b.last_treatment_date,
        next_treatment_date: b.next_treatment_date
      })),
      allBuses: parkedBuses.map(b => ({
        bus_number: b.bus_number,
        operator: b.operator,
        speed: b.speed
      })),
      wazeUrl: `https://waze.com/ul?ll=${hub.lat},${hub.lon}&navigate=yes`,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${hub.lat},${hub.lon}`
    };
  });

  cachedSnapshot = {
    hubs: hubsResult,
    timestamp: now
  };
  lastSnapshotTime = now;

  return cachedSnapshot;
}
