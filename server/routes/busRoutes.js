import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, logAudit } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { extractBusNumberFromImage } from '../ocr.js';
import { validateBusNumber } from '../validators.js';
import { getBusLiveDispatch } from '../services/dispatchService.js';
import { syncFleetFromGov } from '../services/fleetSyncService.js';
import { getLiveDepotsSnapshot } from '../services/depotService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'scan-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }
});

const router = express.Router();

// Helper to evaluate and update bus status based on dates and intervals
export function evaluateBusStatus(bus) {
  if (!bus) {
    return {
      status: 'נדרש טיפול (אוטובוס חדש)',
      canStartTreatment: true,
      blockReason: null,
      message: 'אוטובוס חדש במערכת - מאושר לביצוע טיפול מונע ראשון'
    };
  }

  const now = new Date();

  // If next_treatment_date exists
  if (bus.next_treatment_date) {
    const nextDate = new Date(bus.next_treatment_date);
    if (nextDate > now) {
      const diffMs = nextDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const monthsLeft = Math.ceil(daysLeft / 30);
      return {
        status: 'טיפול בתוקף',
        canStartTreatment: false,
        blockReason: `אין צורך בביצוע טיפול מונע לאוטובוס זה! הטיפול בתוקף (6 חודשים) עד ${nextDate.toLocaleDateString('he-IL')} (תקף לעוד ${daysLeft} ימים / כ-${monthsLeft} חודשים).`,
        message: 'הטיפול בתוקף ל-6 חודשים'
      };
    } else {
      return {
        status: 'טיפול באיחור',
        canStartTreatment: true,
        blockReason: null,
        message: 'מועד הטיפול הבא עבר (חלפו 6 חודשים) - חובה לבצע טיפול מונע'
      };
    }
  }

  // If no explicit next date was set:
  // Check last treatment date (treatments are valid for 6 months = 180 days)
  if (bus.last_treatment_date) {
    const lastDate = new Date(bus.last_treatment_date);
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const VALIDITY_DAYS = 180; // 6 months

    if (bus.status === 'הטיפול הושלם' && diffDays < VALIDITY_DAYS) {
      const daysLeft = VALIDITY_DAYS - diffDays;
      const monthsLeft = Math.ceil(daysLeft / 30);
      return {
        status: 'טיפול בתוקף',
        canStartTreatment: false,
        blockReason: `אין צורך בביצוע טיפול מונע לאוטובוס זה! הטיפול הושלם לפני ${diffDays === 0 ? 'פחות מיום' : diffDays + ' ימים'} (בתאריך ${lastDate.toLocaleDateString('he-IL')}). תוקף הטיפול הוא 6 חודשים (תקף לעוד ${daysLeft} ימים / כ-${monthsLeft} חודשים).`,
        message: 'הטיפול הושלם לאחרונה ונמצא בתוקף ל-6 חודשים'
      };
    }

    if (diffDays >= VALIDITY_DAYS) {
      return {
        status: 'נדרש טיפול (תקופתי)',
        canStartTreatment: true,
        blockReason: null,
        message: `חלפו ${diffDays} ימים (מעל 6 חודשים) מהטיפול הקודם - נדרש טיפול מונע תקופתי`
      };
    }
  }

  // If status is 'הועבר להמשך טיפול'
  if (bus.status === 'הועבר להמשך טיפול') {
    return {
      status: 'הועבר להמשך טיפול',
      canStartTreatment: true,
      blockReason: null,
      message: 'האוטובוס ממתין להמשך טיפול / בדיקה חוזרת'
    };
  }

  // Default
  return {
    status: bus.status || 'נדרש טיפול',
    canStartTreatment: true,
    blockReason: null,
    message: 'האוטובוס זקוק לטיפול מונע'
  };
}

// GET /api/buses/autocomplete?q=1687&operator=...
router.get('/autocomplete', requireAuth, (req, res) => {
  try {
    const q = (req.query.q || '').replace(/[^0-9]/g, '').trim();
    const operator = req.query.operator || null;

    if (!q || q.length < 2) {
      return res.json({ matches: [] });
    }

    let sql = `
      SELECT bus_number, operator, cluster, short_number, status, production_year, last_known_location
      FROM buses
      WHERE (
        bus_number = ? 
        OR bus_number LIKE ? 
        OR short_number = ?
        OR bus_number LIKE '%' || ?
      )
    `;
    const params = [q, `${q}%`, q, q];

    if (operator) {
      sql += ' AND operator = ?';
      params.push(operator);
    }

    sql += ' ORDER BY CASE WHEN bus_number = ? THEN 1 WHEN short_number = ? THEN 2 ELSE 3 END, bus_number ASC LIMIT 8';
    params.push(q, q);

    const matches = db.prepare(sql).all(...params);
    res.json({ matches });
  } catch (err) {
    console.error('Bus autocomplete error:', err);
    res.status(500).json({ error: 'שגיאה בהשלמה אוטומטית' });
  }
});

// GET /api/buses/:busNumber/live-dispatch
router.get('/:busNumber/live-dispatch', requireAuth, async (req, res) => {
  try {
    const busNumber = req.params.busNumber.replace(/[^0-9]/g, '').trim();
    const operator = req.query.operator || null;
    const dispatch = await getBusLiveDispatch(busNumber, operator);
    res.json(dispatch);
  } catch (err) {
    console.error('Live dispatch error:', err);
    res.status(500).json({ error: 'שגיאה בשליפת סידור עבודה' });
  }
});

// POST /api/buses/sync-fleet - Trigger admin sync from data.gov.il
router.post('/sync-fleet', requireAdmin, async (req, res) => {
  try {
    const result = await syncFleetFromGov();
    logAudit(
      req.user.id,
      req.user.fullName,
      'סנכרון צי אוטובוסים',
      'משרד התחבורה',
      'Data.gov.il',
      `סונכרנו בהצלחה ${result.totalBusesInDb} אוטובוסים (${result.totalAdded} חדשים)`
    );
    res.json(result);
  } catch (err) {
    console.error('Fleet sync error:', err);
    res.status(500).json({ error: 'שגיאה בסנכרון צי מול משרד התחבורה' });
  }
});

// GET /api/buses/depots-live - Real-time depots snapshot with buses ready for treatment
router.get('/depots-live', requireAuth, async (req, res) => {
  try {
    const snapshot = await getLiveDepotsSnapshot();
    res.json(snapshot);
  } catch (err) {
    console.error('Depots live error:', err);
    res.status(500).json({ error: 'שגיאה בשליפת מפת חניונים חיה' });
  }
});

// GET /api/buses - Full fleet list & KPI summary for Admin
router.get('/', requireAuth, (req, res) => {
  try {
    const { operator, status, search, page = 1, limit = 50 } = req.query;
    const nowIso = new Date().toISOString();

    // Fleet Summary Stats
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM buses').get().count;
    const br7Count = db.prepare('SELECT COUNT(*) as count FROM buses WHERE operator = ?').get('דן באר שבע').count;
    const daromCount = db.prepare('SELECT COUNT(*) as count FROM buses WHERE operator = ?').get('דן בדרום').count;
    const validCount = db.prepare('SELECT COUNT(*) as count FROM buses WHERE next_treatment_date > ?').get(nowIso).count;
    const pendingCount = totalCount - validCount;
    const progressPercent = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0;

    // Per-operator separate breakdown
    const br7Valid = db.prepare('SELECT COUNT(*) as count FROM buses WHERE operator = ? AND next_treatment_date > ?').get('דן באר שבע', nowIso).count;
    const br7Pending = br7Count - br7Valid;
    const br7Progress = br7Count > 0 ? Math.round((br7Valid / br7Count) * 100) : 0;

    const daromValid = db.prepare('SELECT COUNT(*) as count FROM buses WHERE operator = ? AND next_treatment_date > ?').get('דן בדרום', nowIso).count;
    const daromPending = daromCount - daromValid;
    const daromProgress = daromCount > 0 ? Math.round((daromValid / daromCount) * 100) : 0;

    const hubs = [
      { id: 'habonim_br7', name: 'חניון הבונים', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.22166, lon: 34.80662 },
      { id: 'merkazit_br7', name: 'תחנה מרכזית', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.24128, lon: 34.79799 },
      { id: 'hatzerim_br7', name: 'מסוף חצרים', city: 'באר שבע', operator: 'דן באר שבע', lat: 31.24241, lon: 34.75188 },
      { id: 'eldan_ashkelon', name: 'חניון אלדן', city: 'אשקלון', operator: 'דן בדרום', lat: 31.67319, lon: 34.60244 },
      { id: 'remez_ashkelon', name: 'תחנה מרכזית אשקלון', city: 'אשקלון', operator: 'דן בדרום', lat: 31.66422, lon: 34.56642 },
      { id: 'ashdod_depot', name: 'חניון אשדוד', city: 'אשדוד', operator: 'דן בדרום', lat: 31.82640, lon: 34.66194 },
      { id: 'malakhi_depot', name: 'קרית מלאכי', city: 'קרית מלאכי', operator: 'דן בדרום', lat: 31.73023, lon: 34.75344 },
      { id: 'netivot_depot', name: 'חניון נתיבות', city: 'נתיבות', operator: 'דן בדרום', lat: 31.31684, lon: 34.62841 },
      { id: 'sderot_depot', name: 'חניון שדרות', city: 'שדרות', operator: 'דן בדרום', lat: 31.41128, lon: 34.58334 },
      { id: 'ofakim_depot', name: 'חניון אופקים', city: 'אופקים', operator: 'דן בדרום', lat: 31.52392, lon: 34.60257 },
      { id: 'kiryat_gat', name: 'חניון קרית גת', city: 'קרית גת', operator: 'דן בדרום', lat: 31.58918, lon: 34.78071 }
    ];

    // Filtered Query
    let whereClauses = [];
    let params = [];

    if (operator) {
      whereClauses.push('b.operator = ?');
      params.push(operator);
    }

    if (status === 'valid') {
      whereClauses.push('b.next_treatment_date > ?');
      params.push(nowIso);
    } else if (status === 'pending') {
      whereClauses.push('(b.next_treatment_date IS NULL OR b.next_treatment_date <= ?)');
      params.push(nowIso);
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereClauses.push('(b.bus_number LIKE ? OR b.short_number LIKE ? OR b.last_known_location LIKE ? OR b.cluster LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as count FROM buses b ${whereSql}`;
    const filteredTotal = db.prepare(countSql).get(...params).count;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(10, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const querySql = `
      SELECT b.bus_number, b.operator, b.short_number, b.cluster, b.bus_type, b.production_year,
             b.status, b.last_treatment_date, b.next_treatment_date, b.last_known_location,
             (SELECT r.technician_name FROM reports r WHERE r.bus_number = b.bus_number ORDER BY r.created_at DESC LIMIT 1) as last_technician_name,
             (SELECT COUNT(*) FROM reports r WHERE r.bus_number = b.bus_number) as reports_count
      FROM buses b
      ${whereSql}
      ORDER BY 
        CASE WHEN b.next_treatment_date > ? THEN 1 ELSE 0 END ASC,
        b.bus_number ASC
      LIMIT ? OFFSET ?
    `;

    const buses = db.prepare(querySql).all(...params, nowIso, limitNum, offset);

    res.json({
      summary: {
        total: totalCount,
        treatedValid: validCount,
        pendingTreatment: pendingCount,
        progressPercent,
        danBeerSheva: {
          total: br7Count,
          treatedValid: br7Valid,
          pendingTreatment: br7Pending,
          progressPercent: br7Progress
        },
        danBaDarom: {
          total: daromCount,
          treatedValid: daromValid,
          pendingTreatment: daromPending,
          progressPercent: daromProgress
        },
        hubs
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limitNum)
      },
      buses
    });
  } catch (err) {
    console.error('Fleet list error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת צי האוטובוסים' });
  }
});

// GET /api/buses/search/:busNumber
router.get('/search/:busNumber', requireAuth, async (req, res) => {
  try {
    const busNumber = req.params.busNumber.replace(/[^0-9]/g, '').trim();
    const validationError = validateBusNumber(busNumber);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const busStmt = db.prepare(`
      SELECT b.bus_number, b.operator, b.cluster, b.bus_type, b.production_year,
             b.short_number, b.last_known_location, b.work_plan, b.work_status,
             b.status, b.last_treatment_date, b.next_treatment_date,
             r.technician_name as last_technician_name, r.result as last_result, r.id as last_report_id,
             r.created_at as report_created_at
      FROM buses b
      LEFT JOIN reports r ON r.bus_number = b.bus_number
      WHERE b.bus_number = ?
      ORDER BY r.created_at DESC
      LIMIT 1
    `);

    let bus = busStmt.get(busNumber);

    // Fetch live dispatch in parallel
    const liveDispatch = await getBusLiveDispatch(busNumber, bus?.operator || req.query.operator);

    if (!bus) {
      return res.json({
        exists: false,
        busNumber,
        operator: liveDispatch?.operator || req.query.operator || 'דן באר שבע',
        status: 'נדרש טיפול',
        lastTreatmentDate: null,
        nextTreatmentDate: null,
        lastTechnicianName: null,
        canStartTreatment: true,
        message: 'אוטובוס חדש במערכת - מאושר לביצוע טיפול מונע',
        liveDispatch
      });
    }

    const evaluation = evaluateBusStatus(bus);

    res.json({
      exists: true,
      busNumber: bus.bus_number,
      operator: bus.operator || liveDispatch?.operator || 'דן באר שבע',
      cluster: bus.cluster || null,
      busType: bus.bus_type || null,
      productionYear: bus.production_year || null,
      shortNumber: bus.short_number || liveDispatch?.shortNumber || null,
      status: evaluation.status,
      lastTreatmentDate: bus.last_treatment_date || bus.report_created_at || null,
      nextTreatmentDate: bus.next_treatment_date || null,
      lastTechnicianName: bus.last_technician_name || null,
      lastResult: bus.last_result || null,
      lastReportId: bus.last_report_id || null,
      canStartTreatment: evaluation.canStartTreatment,
      blockReason: evaluation.blockReason,
      message: evaluation.message,
      liveDispatch
    });
  } catch (err) {
    console.error('Bus search error:', err);
    res.status(500).json({ error: 'שגיאה בחיפוש אוטובוס' });
  }
});

// POST /api/buses/scan-photo - OCR scan bus / license plate from photo
router.post('/scan-photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'לא התקבלה תמונה לסריקה' });
    }

    const photoPath = req.file.path;
    const photoUrl = `/uploads/${req.file.filename}`;

    // Run OCR
    const ocrResult = await extractBusNumberFromImage(photoPath);

    const detectedNumber = ocrResult.detectedNumber;
    let busInfo = null;

    if (detectedNumber) {
      const busStmt = db.prepare(`
        SELECT b.bus_number, b.status, b.last_treatment_date, b.next_treatment_date,
               r.technician_name as last_technician_name, r.result as last_result, r.id as last_report_id,
               r.created_at as report_created_at
        FROM buses b
        LEFT JOIN reports r ON r.bus_number = b.bus_number
        WHERE b.bus_number = ?
        ORDER BY r.created_at DESC
        LIMIT 1
      `);
      const bus = busStmt.get(detectedNumber);
      const evalStatus = evaluateBusStatus(bus);

      busInfo = {
        exists: !!bus,
        busNumber: detectedNumber,
        status: evalStatus.status,
        lastTreatmentDate: bus?.last_treatment_date || bus?.report_created_at || null,
        nextTreatmentDate: bus?.next_treatment_date || null,
        lastTechnicianName: bus?.last_technician_name || null,
        canStartTreatment: evalStatus.canStartTreatment,
        blockReason: evalStatus.blockReason,
        message: evalStatus.message
      };
    }

    res.json({
      success: true,
      photoUrl,
      rawText: ocrResult.rawText,
      detectedNumber,
      candidates: ocrResult.candidates || [],
      busInfo
    });
  } catch (err) {
    console.error('Photo scan error:', err);
    res.status(500).json({ error: 'שגיאה בסריקת התמונה' });
  }
});

// POST /api/buses/next-treatment (Manager only)
router.post('/next-treatment', requireAdmin, (req, res) => {
  try {
    const { busNumber, nextTreatmentDate } = req.body;

    if (!busNumber || !nextTreatmentDate) {
      return res.status(400).json({ error: 'נא להזין מספר אוטובוס ותאריך טיפול הבא' });
    }

    const cleanBusNumber = String(busNumber).replace(/[^0-9]/g, '').trim();
    const dateObj = new Date(nextTreatmentDate);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'תאריך טיפול הבא אינו תקין' });
    }

    const now = new Date();
    const status = dateObj > now ? 'טיפול בתוקף' : 'נדרש טיפול';

    // Upsert bus
    const checkStmt = db.prepare('SELECT bus_number FROM buses WHERE bus_number = ?');
    const existing = checkStmt.get(cleanBusNumber);

    if (existing) {
      const updateStmt = db.prepare(`
        UPDATE buses 
        SET next_treatment_date = ?, status = ?, updated_at = datetime('now')
        WHERE bus_number = ?
      `);
      updateStmt.run(dateObj.toISOString(), status, cleanBusNumber);
    } else {
      const insertStmt = db.prepare(`
        INSERT INTO buses (bus_number, next_treatment_date, status, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `);
      insertStmt.run(cleanBusNumber, dateObj.toISOString(), status);
    }

    logAudit(
      req.user.id,
      req.user.fullName,
      'קביעת מועד טיפול הבא',
      'אוטובוס',
      cleanBusNumber,
      `נקבע תאריך: ${dateObj.toLocaleDateString('he-IL')}, סטטוס: ${status}`
    );

    res.json({
      success: true,
      busNumber: cleanBusNumber,
      nextTreatmentDate: dateObj.toISOString(),
      status
    });
  } catch (err) {
    console.error('Update next treatment error:', err);
    res.status(500).json({ error: 'שגיאה בעדכון מועד טיפול הבא' });
  }
});

export default router;
