import { db } from '../db.js';
import { getStationNameFromCoords } from './depotService.js';

const cache = new Map();
const CACHE_TTL_MS = 15 * 1000; // 15 seconds cache for live GPS

const toMins = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Fetches real-time GPS telemetry from sym_pos.php
 */
async function fetchGpsCoordinates(opId, cleanBusNumber) {
  try {
    const url = `https://ops.dandarom.co.il/src/symcotech/sym_pos.php?operatorId=${opId}&car_number=${encodeURIComponent(cleanBusNumber)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].Lat && data[0].Lon) {
        const item = data[0];
        const lat = parseFloat(item.Lat);
        const lon = parseFloat(item.Lon);
        if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
          return {
            hasGps: true,
            lat,
            lon,
            speed: parseInt(item.Speed || 0),
            heading: parseInt(item.Heading || 0),
            mileage: parseInt(item.Mileage || 0),
            gpsTime: item.SpmTime || null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
            wazeUrl: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
            embedMapUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${(lon - 0.006).toFixed(6)},${(lat - 0.004).toFixed(6)},${(lon + 0.006).toFixed(6)},${(lat + 0.004).toFixed(6)}&layer=mapnik&marker=${lat.toFixed(6)},${lon.toFixed(6)}`
          };
        }
      }
    }
  } catch (e) {}
  return null;
}

export function getIsraelNowMinutes() {
  const now = new Date();
  const ilTimeStr = now.toLocaleTimeString('en-US', { 
    timeZone: 'Asia/Jerusalem', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const [h, m] = ilTimeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Calculates smart layover window, time sufficiency, and destination for navigation
 */
function analyzeTimeWindowAndNavigation(tasks, currentTask, operatorName, gpsInfo = null) {
  const nowMinutes = getIsraelNowMinutes();

  let targetStation = currentTask.acc_name || '';
  const desc = currentTask.line_description || '';

  // Extract destination from "Origin - Destination"
  if (desc.includes('-')) {
    const parts = desc.split('-');
    targetStation = parts[parts.length - 1].trim();
  } else if (desc.includes(':')) {
    const parts = desc.split(':');
    targetStation = parts[parts.length - 1].trim();
  }

  // If bus is parked (speed 0) and has GPS coordinates, resolve exact station/depot name
  if (gpsInfo && gpsInfo.speed === 0 && gpsInfo.lat && gpsInfo.lon) {
    const resolved = getStationNameFromCoords(gpsInfo.lat, gpsInfo.lon);
    if (resolved) {
      targetStation = resolved.stationName;
    }
  }

  const taskIndex = tasks.findIndex(t => t === currentTask);
  const isLastTask = taskIndex === tasks.length - 1 || desc.includes('גמר משמרת');
  const isTripActive = String(currentTask.line_status) === '3';

  let isShiftFinished = false;
  let isTimeSufficient = false;
  let timeVerdictText = '';
  let timeBadgeType = 'NEUTRAL'; // SUCCESS, WARNING, DANGER
  let availableMinutes = 0;
  let nextDeparture = '';

  // Check if no more tasks today
  const remainingTasks = tasks.slice(taskIndex + 1).filter(t => !t.line_description?.includes('גמר משמרת'));

  if (isLastTask || remainingTasks.length === 0) {
    isShiftFinished = true;
    isTimeSufficient = true;
    timeBadgeType = 'SUCCESS';
    timeVerdictText = '🏁 סיים משמרת להיום – חופשי ללילה בחניון!';
  } else {
    // There are upcoming tasks today
    const nextTask = remainingTasks[0];
    nextDeparture = nextTask.order_start_time || '';

    // Check if next task is a deadhead move (נסיעה ריקה)
    if (nextTask.line_description?.includes('נסיעה ריקה')) {
      const deadheadDestination = nextTask.line_description.split('-')[1]?.trim();
      if (deadheadDestination) targetStation = deadheadDestination;

      const afterDeadhead = remainingTasks[1];
      if (afterDeadhead) {
        nextDeparture = afterDeadhead.order_start_time;
        const deadheadEnd = toMins(nextTask.order_end_time);
        const nextStart = toMins(afterDeadhead.order_start_time);
        availableMinutes = Math.max(0, nextStart - deadheadEnd);
      } else {
        isShiftFinished = true;
        isTimeSufficient = true;
        timeBadgeType = 'SUCCESS';
        timeVerdictText = '🏁 לאחר נסיעה ריקה מסיים משמרת להיום!';
      }
    } else {
      const currentEnd = toMins(currentTask.order_end_time);
      const nextStart = toMins(nextTask.order_start_time);
      availableMinutes = Math.max(0, nextStart - currentEnd);
    }

    if (!isShiftFinished) {
      if (isTripActive) {
        // Bus currently driving
        if (availableMinutes >= 20) {
          timeBadgeType = 'WARNING';
          isTimeSufficient = true;
          timeVerdictText = `🟡 בנסיעה כעת (מסיים ב-${currentTask.order_end_time}) – לאחר מכן יש ${availableMinutes} דק׳ פנויות עד ${nextDeparture}`;
        } else {
          timeBadgeType = 'DANGER';
          isTimeSufficient = false;
          timeVerdictText = `⛔ בנסיעה כעת (מסיים ב-${currentTask.order_end_time}) – הפסקה קצרה של ${availableMinutes} דק׳ בלבד (יוצא שוב ב-${nextDeparture}). לא מספיק לטיפול (נדרש מינימום 20 דק׳)!`;
        }
      } else {
        // Bus currently parked at station / depot
        let remainingNow = toMins(nextDeparture) - nowMinutes;
        if (remainingNow < 0 && toMins(nextDeparture) < 240) {
          remainingNow += 1440;
        }
        remainingNow = Math.max(0, remainingNow);
        availableMinutes = remainingNow;

        if (remainingNow >= 20) {
          timeBadgeType = 'SUCCESS';
          isTimeSufficient = true;
          timeVerdictText = `🟢 פנוי לטיפול מונע! נותרו ${remainingNow} דקות פנויות (יוצא ב-${nextDeparture})`;
        } else {
          timeBadgeType = 'DANGER';
          isTimeSufficient = false;
          timeVerdictText = `⛔ הפסקה קצרה (${remainingNow} דק׳ נותרו) – יוצא ב-${nextDeparture}. אין מספיק זמן (מינימום 20 דק׳ לטיפול מונע)!`;
        }
      }
    }
  }

  // Navigation Links
  let mapsUrl = gpsInfo?.mapsUrl;
  let wazeUrl = gpsInfo?.wazeUrl;

  if (!mapsUrl) {
    const cityHint = operatorName.includes('באר שבע') ? 'באר שבע' : 'אשקלון נתיבות';
    const navQuery = `${targetStation} ${cityHint}`;
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navQuery)}`;
    wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(navQuery)}&navigate=yes`;
  }

  return {
    targetStation,
    mapsUrl,
    wazeUrl,
    embedMapUrl: gpsInfo?.embedMapUrl || null,
    isShiftFinished,
    isTimeSufficient,
    timeVerdictText,
    timeBadgeType,
    availableMinutes,
    nextDeparture
  };
}

/**
 * Fetches real-time dispatch and GPS location for a given bus number
 */
export async function getBusLiveDispatch(busNumber, requestedOperator = null) {
  if (!busNumber) return null;

  const cleanBusNumber = String(busNumber).trim();
  const cacheKey = `${cleanBusNumber}_${requestedOperator || ''}`;
  const now = Date.now();

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Determine operator
  let operator = requestedOperator;
  if (!operator) {
    const row = db.prepare('SELECT operator, cluster FROM buses WHERE bus_number = ?').get(cleanBusNumber);
    if (row) {
      operator = row.operator;
    }
  }

  const operatorIds = [];
  if (operator === 'דן באר שבע') {
    operatorIds.push(32);
  } else if (operator === 'דן בדרום') {
    operatorIds.push(31);
  } else {
    operatorIds.push(31, 32);
  }

  for (const opId of operatorIds) {
    try {
      // 1. Fetch live GPS coordinates from sym_pos.php in parallel
      const gpsPromise = fetchGpsCoordinates(opId, cleanBusNumber);

      // 2. Fetch live dispatch work schedule
      const workUrl = `https://ops.dandarom.co.il/src/symcotech/ws_work.php?operatorId=${opId}&car_number=${encodeURIComponent(cleanBusNumber)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const [workRes, gpsInfo] = await Promise.all([
        fetch(workUrl, { signal: controller.signal }).catch(() => null),
        gpsPromise
      ]);
      clearTimeout(timeoutId);

      const opName = opId === 32 ? 'דן באר שבע' : 'דן בדרום';

      let data = [];
      if (workRes && workRes.ok) {
        data = await workRes.json().catch(() => []);
      }

      if (!Array.isArray(data) || data.length === 0) {
        // If no work tasks but we have live GPS from sym_pos.php:
        if (gpsInfo && gpsInfo.hasGps) {
            const resolved = getStationNameFromCoords(gpsInfo.lat, gpsInfo.lon);
            const station = resolved ? resolved.stationName : (opName.includes('באר שבע') ? 'חניון באר שבע' : 'חניון דן בדרום');
            const city = resolved ? resolved.cityName : (opName.includes('באר שבע') ? 'באר שבע' : 'אשקלון / דרום');

            const result = {
              hasLiveDispatch: true,
              hasGps: true,
              operator: opName,
              operatorId: opId,
              location: city,
              targetStation: station,
              lineDescription: gpsInfo.speed > 0 ? `בנסיעה (${gpsInfo.speed} קמ"ש)` : `עומד במקום (${station})`,
              statusLabel: gpsInfo.speed > 0 ? 'בנסיעה פעילה' : 'פנוי בחניון',
              isParked: gpsInfo.speed === 0,
              timeRange: '',
            lat: gpsInfo.lat,
            lon: gpsInfo.lon,
            speed: gpsInfo.speed,
            heading: gpsInfo.heading,
            mileage: gpsInfo.mileage,
            gpsTime: gpsInfo.gpsTime,
            mapsUrl: gpsInfo.mapsUrl,
            wazeUrl: gpsInfo.wazeUrl,
            embedMapUrl: gpsInfo.embedMapUrl,
            isTimeSufficient: gpsInfo.speed === 0,
            timeBadgeType: gpsInfo.speed === 0 ? 'SUCCESS' : 'WARNING',
            timeVerdictText: gpsInfo.speed === 0 ? '🟢 עומד במקום (מהירות 0 קמ"ש) – פנוי לטיפול!' : `🟡 בנסיעה כעת במהירות ${gpsInfo.speed} קמ"ש`
          };
          cache.set(cacheKey, { timestamp: now, data: result });
          return result;
        }
        continue;
      }

      // Find active or latest task
      let selectedTask = data.find(t => String(t.line_status) === '3');
      if (!selectedTask) {
        selectedTask = data.find(t => String(t.line_status) === '2');
      }
      if (!selectedTask) {
        const completed = data.filter(t => String(t.line_status) === '4');
        if (completed.length > 0) {
          selectedTask = completed[completed.length - 1];
        } else {
          selectedTask = data[data.length - 1];
        }
      }

      const statusNum = String(selectedTask.line_status || '');
      let statusLabel = 'לא ידוע';
      let isParked = false;

      if (statusNum === '4') {
        statusLabel = 'נסיעה הסתיימה (פנוי בחניון)';
        isParked = true;
      } else if (statusNum === '3') {
        statusLabel = 'בנסיעה פעילה בקו';
        isParked = false;
      } else if (statusNum === '2') {
        statusLabel = 'נסיעה התקבלה לביצוע';
        isParked = false;
      } else if (statusNum === '1') {
        statusLabel = 'משימה נשלחה לנהג';
        isParked = false;
      }

      const desc = selectedTask.line_description || '';
      if (desc.includes('מנוחה') || desc.includes('הכנת מכונה') || desc.includes('חניון') || desc.includes('גמר')) {
        isParked = true;
        if (statusNum === '4' || statusNum === '2' || statusNum === '1') {
          statusLabel = 'בחניון / הפסקה';
        }
      }

      // If GPS says speed is 0 and task completed -> definitely parked
      if (gpsInfo && gpsInfo.speed === 0 && statusNum === '4') {
        isParked = true;
      }

      // Compute smart layover time and maps navigation
      const timingAnalysis = analyzeTimeWindowAndNavigation(data, selectedTask, opName, gpsInfo);

      const result = {
        hasLiveDispatch: true,
        hasGps: Boolean(gpsInfo?.hasGps),
        operator: opName,
        operatorId: opId,
        shortNumber: selectedTask.car_Short_number ? String(selectedTask.car_Short_number) : null,
        location: selectedTask.acc_name || 'מרכז תפעול',
        lineDescription: desc,
        startTime: selectedTask.order_start_time || '',
        endTime: selectedTask.order_end_time || '',
        timeRange: `${selectedTask.order_start_time || ''} - ${selectedTask.order_end_time || ''}`,
        statusCode: statusNum,
        statusLabel,
        isParked,
        totalTasksToday: data.length,
        // Live GPS Telemetry
        lat: gpsInfo?.lat || null,
        lon: gpsInfo?.lon || null,
        speed: gpsInfo?.speed ?? null,
        heading: gpsInfo?.heading ?? null,
        mileage: gpsInfo?.mileage ?? null,
        gpsTime: gpsInfo?.gpsTime || null,
        mapsUrl: timingAnalysis.mapsUrl,
        wazeUrl: timingAnalysis.wazeUrl,
        embedMapUrl: timingAnalysis.embedMapUrl,
        // Smart Timing
        targetStation: timingAnalysis.targetStation,
        isTimeSufficient: timingAnalysis.isTimeSufficient,
        timeVerdictText: timingAnalysis.timeVerdictText,
        timeBadgeType: timingAnalysis.timeBadgeType,
        availableMinutes: timingAnalysis.availableMinutes,
        nextDeparture: timingAnalysis.nextDeparture,
        isShiftFinished: timingAnalysis.isShiftFinished,
        // Full daily schedule tasks
        schedule: data.map((t) => {
          const sNum = String(t.line_status || '');
          let sText = 'מתוכנן';
          if (sNum === '4') sText = 'הושלם';
          else if (sNum === '3') sText = 'פעיל כעת';
          else if (sNum === '2') sText = 'התקבל';
          return {
            startTime: t.order_start_time || '',
            endTime: t.order_end_time || '',
            description: t.line_description || '',
            accName: t.acc_name || '',
            statusCode: sNum,
            statusText: sText,
            isCurrent: t === selectedTask
          };
        })
      };

      // Save latest known location to DB for offline reference
      try {
        db.prepare(`
          UPDATE buses 
          SET last_known_location = ?, work_plan = ?, work_status = ?, updated_at = datetime('now')
          WHERE bus_number = ?
        `).run(result.location, result.lineDescription, result.statusLabel, cleanBusNumber);
      } catch (e) {}

      cache.set(cacheKey, { timestamp: now, data: result });
      return result;
    } catch (e) {
      // Ignore network timeout and try next
    }
  }

  // Fallback if no active schedule today
  const row = db.prepare('SELECT cluster, last_known_location, work_plan, work_status FROM buses WHERE bus_number = ?').get(cleanBusNumber);
  const fallbackLoc = row?.last_known_location || row?.cluster || 'מרכז תפעול';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackLoc)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(fallbackLoc)}&navigate=yes`;

  const fallback = {
    hasLiveDispatch: false,
    hasGps: false,
    location: fallbackLoc,
    targetStation: fallbackLoc,
    mapsUrl,
    wazeUrl,
    lineDescription: row?.work_plan || 'אין סידור עבודה פעיל במערכת',
    statusLabel: row?.work_status || 'פנוי בחניון',
    isParked: true,
    timeRange: '',
    isTimeSufficient: true,
    timeBadgeType: 'SUCCESS',
    timeVerdictText: '🟢 פנוי בחניון – אין נסיעות מתוכננות כעת'
  };

  cache.set(cacheKey, { timestamp: now, data: fallback });
  return fallback;
}
