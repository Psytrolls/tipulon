import { db } from '../db.js';

export const HUBS = [
  { 
    id: 'eldan_ashkelon', 
    name: 'חניון אלדן (פארק צפוני)', 
    shortName: 'חניון אלדן',
    city: 'אשקלון', 
    operator: 'דן בדרום', 
    lat: 31.67319, 
    lon: 34.60244,
    keywords: ['אלדן', 'אשקלון עירוני', 'אשקלון'] 
  },
  { 
    id: 'habonim_br7', 
    name: 'חניון הבונים (עמק שרה)', 
    shortName: 'חניון הבונים',
    city: 'באר שבע', 
    operator: 'דן באר שבע', 
    lat: 31.22166, 
    lon: 34.80662,
    keywords: ['הבונים', 'עמק שרה', 'באר שבע עירוני'] 
  },
  { 
    id: 'merkazit_br7', 
    name: 'תחנה מרכזית באר שבע', 
    shortName: 'תחנה מרכזית',
    city: 'באר שבע', 
    operator: 'דן באר שבע', 
    lat: 31.24128, 
    lon: 34.79799,
    keywords: ['תחנה מרכזית', 'רכבת מרכז', 'באר שבע'] 
  },
  { 
    id: 'remez_ashkelon', 
    name: 'מסוף רמז', 
    shortName: 'מסוף רמז',
    city: 'אשקלון', 
    operator: 'דן בדרום', 
    lat: 31.66422, 
    lon: 34.56642,
    keywords: ['רמז', 'שמשון', 'אשקלון'] 
  },
  { 
    id: 'netivot_depot', 
    name: 'חניון ומסוף רכבת נתיבות', 
    shortName: 'חניון נתיבות',
    city: 'נתיבות', 
    operator: 'דן בדרום', 
    lat: 31.31684, 
    lon: 34.62841,
    keywords: ['נתיבות'] 
  },
  { 
    id: 'sderot_depot', 
    name: 'חניון ומסוף שדרות', 
    shortName: 'חניון שדרות',
    city: 'שדרות', 
    operator: 'דן בדרום', 
    lat: 31.41128, 
    lon: 34.58334,
    keywords: ['שדרות'] 
  },
  { 
    id: 'ofakim_depot', 
    name: 'חניון עירוני אופקים', 
    shortName: 'חניון אופקים',
    city: 'אופקים', 
    operator: 'דן בדרום', 
    lat: 31.52392, 
    lon: 34.60257,
    keywords: ['אופקים'] 
  },
  { 
    id: 'kiryat_gat', 
    name: 'חניון ומסוף קרית גת', 
    shortName: 'חניון קרית גת',
    city: 'קרית גת', 
    operator: 'דן בדרום', 
    lat: 31.58918, 
    lon: 34.78071,
    keywords: ['קרית גת', 'גת'] 
  }
];

let cachedSnapshot = null;
let lastSnapshotTime = 0;
const SNAPSHOT_TTL = 45 * 1000; // 45 seconds cache

/**
 * Returns live status of all depots, parked buses, and buses requiring maintenance
 */
export async function getLiveDepotsSnapshot() {
  const now = Date.now();
  if (cachedSnapshot && (now - lastSnapshotTime < SNAPSHOT_TTL)) {
    return cachedSnapshot;
  }

  const nowIso = new Date().toISOString();

  // 1. Get all buses from DB
  const allBuses = db.prepare(`
    SELECT bus_number, short_number, operator, cluster, last_known_location, work_status,
           next_treatment_date, last_treatment_date
    FROM buses
  `).all();

  // 2. Fetch a batch of live GPS telemetry to discover real-time parked buses
  const sampleBuses = allBuses.slice(0, 100);
  const busLocationMap = new Map();

  // Batch query GPS in chunks of 15
  for (let i = 0; i < sampleBuses.length; i += 15) {
    const chunk = sampleBuses.slice(i, i + 15);
    await Promise.all(chunk.map(async (b) => {
      const opId = b.operator === 'דן בדרום' ? 31 : 32;
      try {
        const url = `https://ops.dandarom.co.il/src/symcotech/sym_pos.php?operatorId=${opId}&car_number=${b.bus_number}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && data[0].Lat && data[0].Lon) {
            const lat = parseFloat(data[0].Lat);
            const lon = parseFloat(data[0].Lon);
            const speed = parseInt(data[0].Speed || 0);
            if (lat > 30 && lon > 34) {
              busLocationMap.set(b.bus_number, { lat, lon, speed, isParked: speed === 0 });
            }
          }
        }
      } catch (e) {}
    }));
  }

  // 3. Match buses to hubs
  const hubsResult = HUBS.map((hub) => {
    const matchedBuses = [];

    for (const b of allBuses) {
      const gps = busLocationMap.get(b.bus_number);
      let isInsideHub = false;

      // Check GPS coordinate match (within ~1.5km)
      if (gps && Math.abs(gps.lat - hub.lat) < 0.015 && Math.abs(gps.lon - hub.lon) < 0.015) {
        isInsideHub = true;
      } 
      // Or check text location / cluster match
      else if (b.last_known_location && hub.keywords.some(kw => b.last_known_location.includes(kw))) {
        isInsideHub = true;
      }
      else if (b.cluster && hub.keywords.some(kw => b.cluster.includes(kw))) {
        isInsideHub = true;
      }

      if (isInsideHub) {
        const needsTreatment = !b.next_treatment_date || new Date(b.next_treatment_date) <= new Date();
        matchedBuses.push({
          bus_number: b.bus_number,
          short_number: b.short_number || b.bus_number.slice(-4),
          operator: b.operator,
          needsTreatment,
          next_treatment_date: b.next_treatment_date,
          last_treatment_date: b.last_treatment_date,
          isParked: gps ? gps.isParked : true,
          speed: gps ? gps.speed : 0
        });
      }
    }

    const availableForTreatment = matchedBuses.filter(b => b.needsTreatment && b.isParked);

    return {
      id: hub.id,
      name: hub.name,
      shortName: hub.shortName,
      city: hub.city,
      operator: hub.operator,
      lat: hub.lat,
      lon: hub.lon,
      totalParkedCount: matchedBuses.filter(b => b.isParked).length,
      availableForTreatmentCount: availableForTreatment.length,
      busesForTreatment: availableForTreatment.slice(0, 15),
      allBuses: matchedBuses.slice(0, 30),
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
