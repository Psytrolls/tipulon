import { db } from '../db.js';

const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

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

  // operatorId 31 = דן בדרום, 32 = דן באר שבע
  const operatorIds = [];
  if (operator === 'דן באר שבע') {
    operatorIds.push(32);
  } else if (operator === 'דן בדרום') {
    operatorIds.push(31);
  } else {
    // If unknown, test 31 first then 32
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

      // Found active schedule tasks!
      const opName = opId === 32 ? 'דן באר שבע' : 'דן בדרום';

      // Find active or latest task
      // Priority 1: status "3" (Active trip right now)
      // Priority 2: status "2" (Accepted)
      // Priority 3: status "4" (Completed - parked)
      let selectedTask = data.find(t => String(t.line_status) === '3');
      if (!selectedTask) {
        selectedTask = data.find(t => String(t.line_status) === '2');
      }
      if (!selectedTask) {
        // Find latest completed task
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
      if (desc.includes('מנוחה') || desc.includes('הכנת מכונה') || desc.includes('חניון')) {
        isParked = true;
        if (statusNum === '4' || statusNum === '2') {
          statusLabel = 'בחניון / הפסקה';
        }
      }

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
        totalTasksToday: data.length
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

  // If no live dispatch found, fallback to database cached location/cluster
  const row = db.prepare('SELECT cluster, last_known_location, work_plan, work_status FROM buses WHERE bus_number = ?').get(cleanBusNumber);
  const fallback = {
    hasLiveDispatch: false,
    location: row?.last_known_location || row?.cluster || 'מרכז תפעול',
    lineDescription: row?.work_plan || 'אין סידור עבודה פעיל במערכת',
    statusLabel: row?.work_status || 'פנוי / לא בנסיעה',
    isParked: true,
    timeRange: ''
  };

  cache.set(cacheKey, { timestamp: now, data: fallback });
  return fallback;
}
