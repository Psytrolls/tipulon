import { db } from '../db.js';
import { getBusLiveDispatch } from './dispatchService.js';

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
    id: 'merkazit_ashkelon', 
    name: 'תחנה מרכזית אשקלון', 
    shortName: 'תחנה מרכזית',
    city: 'אשקלון', 
    operator: 'דן בדרום', 
    lat: 31.66800, 
    lon: 34.57200
  },
  { 
    id: 'remez_ashkelon', 
    name: 'מסוף רמז', 
    shortName: 'מסוף רמז',
    city: 'אשקלון', 
    operator: 'דן בדרום', 
    lat: 31.66440, 
    lon: 34.56660
  },
  { 
    id: 'ashdod_depot', 
    name: 'חניון ומסוף עד הלום (אשדוד)', 
    shortName: 'עד הלום אשדוד',
    city: 'אשדוד', 
    operator: 'דן בדרום', 
    lat: 31.78000, 
    lon: 34.66520
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

  // 2. Fetch live GPS telemetry from Dan's ops server for the full fleet
  const busLocations = [];

  // Batch query GPS across entire fleet in chunks of 50
  for (let i = 0; i < allBuses.length; i += 50) {
    const chunk = allBuses.slice(i, i + 50);
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

  // 3. Match buses to hubs: Each parked bus is matched to its SINGLE CLOSEST hub (within max 800m)
  const hubsResult = await Promise.all(HUBS.map(async (hub) => {
    const busesAtHub = busLocations.filter(b => {
      const dist = Math.hypot(b.lat - hub.lat, b.lon - hub.lon);
      if (dist > 0.008) return false;

      // Must be the closest hub to prevent overlap between adjacent terminals
      let closestHubId = hub.id;
      let minDistance = dist;
      for (const other of HUBS) {
        const d = Math.hypot(b.lat - other.lat, b.lon - other.lon);
        if (d < minDistance) {
          minDistance = d;
          closestHubId = other.id;
        }
      }
      return closestHubId === hub.id;
    });

    const parkedBuses = busesAtHub.filter(b => b.isParked);

    // Buses needing treatment based on 6-month rule
    const candidateBuses = parkedBuses.filter(b => 
      !b.next_treatment_date || new Date(b.next_treatment_date) <= new Date()
    );

    // Filter candidate buses: MUST HAVE NO ACTIVE SCHEDULE OR FINISHED SHIFT OR BREAK >= 20 MINUTES
    const verifiedCandidates = await Promise.all(
      candidateBuses.slice(0, 25).map(async (b) => {
        try {
          const disp = await getBusLiveDispatch(b.bus_number, b.operator);
          const hasNoSchedule = !disp || !disp.schedule || disp.schedule.length === 0;
          const isShiftDone = Boolean(disp?.isShiftFinished);
          const availMins = disp?.availableMinutes ?? 0;

          // Condition: No sidur OR shift finished OR break >= 20 minutes
          if (hasNoSchedule || isShiftDone || availMins >= 20) {
            let statusHint = 'חופשי (ללא משימות כעת)';
            if (isShiftDone) statusHint = '🏁 סיים משמרת להיום (חופשי ללילה)';
            else if (availMins >= 20) statusHint = `🟢 הפסקה פנויה (${availMins} דק׳ עד ${disp?.nextDeparture || ''})`;
            else if (hasNoSchedule) statusHint = 'ללא סידור עבודה היום';

            return {
              bus_number: b.bus_number,
              operator: b.operator,
              last_treatment_date: b.last_treatment_date,
              next_treatment_date: b.next_treatment_date,
              statusHint,
              availableMinutes: availMins,
              nextDeparture: disp?.nextDeparture || null
            };
          }
          return null; // Excluded because break is < 20 minutes or currently driving
        } catch (e) {
          return null;
        }
      })
    );

    const eligibleBusesForTreatment = verifiedCandidates.filter(Boolean);

    return {
      id: hub.id,
      name: hub.name,
      shortName: hub.shortName,
      city: hub.city,
      operator: hub.operator,
      lat: hub.lat,
      lon: hub.lon,
      totalParkedCount: parkedBuses.length,
      availableForTreatmentCount: eligibleBusesForTreatment.length,
      busesForTreatment: eligibleBusesForTreatment,
      allBuses: parkedBuses.map(b => ({
        bus_number: b.bus_number,
        operator: b.operator,
        speed: b.speed
      })),
      wazeUrl: `https://waze.com/ul?ll=${hub.lat},${hub.lon}&navigate=yes`,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${hub.lat},${hub.lon}`
    };
  }));

  cachedSnapshot = {
    hubs: hubsResult,
    timestamp: now
  };
  lastSnapshotTime = now;

  return cachedSnapshot;
}

/**
 * Resolves exact station name and city from GPS coordinates
 */
export function getStationNameFromCoords(lat, lon) {
  if (!lat || !lon) return null;
  let closestHub = null;
  let minDistance = Infinity;

  for (const hub of HUBS) {
    const dLat = hub.lat - lat;
    const dLon = hub.lon - lon;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < minDistance) {
      minDistance = dist;
      closestHub = hub;
    }
  }

  // 0.015 degrees is roughly ~1.5 km
  if (closestHub && minDistance <= 0.015) {
    return {
      stationName: closestHub.name,
      cityName: closestHub.city,
      hubId: closestHub.id
    };
  }

  // General city boundary detection if outside known depots
  if (lat >= 31.63 && lat <= 31.70 && lon >= 34.53 && lon <= 34.63) {
    return { stationName: 'אשקלון', cityName: 'אשקלון', hubId: null };
  }
  if (lat >= 31.20 && lat <= 31.28 && lon >= 34.73 && lon <= 34.84) {
    return { stationName: 'באר שבע', cityName: 'באר שבע', hubId: null };
  }
  if (lat >= 31.76 && lat <= 31.86 && lon >= 34.60 && lon <= 34.70) {
    return { stationName: 'אשדוד', cityName: 'אשדוד', hubId: null };
  }
  if (lat >= 31.70 && lat <= 31.76 && lon >= 34.71 && lon <= 34.78) {
    return { stationName: 'קרית מלאכי', cityName: 'קרית מלאכי', hubId: null };
  }
  if (lat >= 31.29 && lat <= 31.35 && lon >= 34.58 && lon <= 34.66) {
    return { stationName: 'נתיבות', cityName: 'נתיבות', hubId: null };
  }
  if (lat >= 31.39 && lat <= 31.45 && lon >= 34.55 && lon <= 34.62) {
    return { stationName: 'שדרות', cityName: 'שדרות', hubId: null };
  }
  if (lat >= 31.50 && lat <= 31.55 && lon >= 34.57 && lon <= 34.64) {
    return { stationName: 'אופקים', cityName: 'אופקים', hubId: null };
  }
  if (lat >= 31.56 && lat <= 31.63 && lon >= 34.74 && lon <= 34.82) {
    return { stationName: 'קרית גת', cityName: 'קרית גת', hubId: null };
  }

  return null;
}
