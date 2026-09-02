import { db } from '../db.js';

const cache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

const toMins = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Calculates smart layover window, time sufficiency, and destination for navigation
 */
function analyzeTimeWindowAndNavigation(tasks, currentTask, operatorName) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

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

  const taskIndex = tasks.findIndex(t => t === currentTask);
  const isLastTask = taskIndex === tasks.length - 1 || desc.includes('גמר משמרת');
  const isTripActive = String(currentTask.line_status) === '3';
  const isTripCompleted = String(currentTask.line_status) === '4';

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
        if (availableMinutes >= 15) {
          timeBadgeType = 'WARNING';
          isTimeSufficient = true;
          timeVerdictText = `🟡 בנסיעה כעת (מסיים ב-${currentTask.order_end_time}) – לאחר מכן יש ${availableMinutes} דק׳ פנויות עד ${nextDeparture}`;
        } else {
          timeBadgeType = 'DANGER';
          isTimeSufficient = false;
          timeVerdictText = `⛔ בנסיעה כעת (מסיים ב-${currentTask.order_end_time}) – הפסקה קצרה של ${availableMinutes} דק׳ בלבד (יוצא שוב ב-${nextDeparture}). לא מספיק לטיפול!`;
        }
      } else {
        // Bus currently parked at station / depot
        // Calculate remaining minutes from NOW to next departure
        const remainingNow = Math.max(0, toMins(nextDeparture) - nowMinutes);
        if (remainingNow >= 15) {
          timeBadgeType = 'SUCCESS';
          isTimeSufficient = true;
          timeVerdictText = `🟢 פנוי לטיפול מונע! נותרו ${remainingNow} דקות פנויות (יוצא ב-${nextDeparture})`;
        } else {
          timeBadgeType = 'DANGER';
          isTimeSufficient = false;
          timeVerdictText = `⛔ הפסקה קצרה (${remainingNow} דק׳ נותרו) – יוצא ב-${nextDeparture}. אין מספיק זמן (מינימום 15–30 דק׳)!`;
        }
      }
    }
  }

  // Navigation Links for Google Maps and Waze
  const cityHint = operatorName.includes('באר שבע') ? 'באר שבע' : 'אשקלון נתיבות';
  const cleanStation = targetStation.replace(/^(קו|מסוף|תחנה|שד\.|רחוב)\s*/i, '').trim();
  const navQuery = `${targetStation} ${cityHint}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navQuery)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(navQuery)}&navigate=yes`;

  return {
    targetStation,
    cleanStation,
    mapsUrl,
    wazeUrl,
    isShiftFinished,
    isTimeSufficient,
    timeVerdictText,
    timeBadgeType,
    availableMinutes,
    nextDeparture
  };
}

/**
 * Fetches real-time dispatch and location for a given bus number
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
      const url = `https://ops.dandarom.co.il/src/symcotech/ws_work.php?operatorId=${opId}&car_number=${encodeURIComponent(cleanBusNumber)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const opName = opId === 32 ? 'דן באר שבע' : 'דן בדרום';

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

      // Compute smart layover time and maps navigation
      const timingAnalysis = analyzeTimeWindowAndNavigation(data, selectedTask, opName);

      const result = {
        hasLiveDispatch: true,
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
        // Smart Timing & Map Navigation
        targetStation: timingAnalysis.targetStation,
        mapsUrl: timingAnalysis.mapsUrl,
        wazeUrl: timingAnalysis.wazeUrl,
        isTimeSufficient: timingAnalysis.isTimeSufficient,
        timeVerdictText: timingAnalysis.timeVerdictText,
        timeBadgeType: timingAnalysis.timeBadgeType,
        availableMinutes: timingAnalysis.availableMinutes,
        nextDeparture: timingAnalysis.nextDeparture,
        isShiftFinished: timingAnalysis.isShiftFinished
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
