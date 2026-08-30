import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, logAudit } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { extractBusNumberFromImage } from '../ocr.js';
import { validateBusNumber } from '../validators.js';

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

// GET /api/buses/search/:busNumber
router.get('/search/:busNumber', requireAuth, (req, res) => {
  try {
    const busNumber = req.params.busNumber.replace(/[^0-9]/g, '').trim();
    const validationError = validateBusNumber(busNumber);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

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

    let bus = busStmt.get(busNumber);

    if (!bus) {
      return res.json({
        exists: false,
        busNumber,
        status: 'נדרש טיפול',
        lastTreatmentDate: null,
        nextTreatmentDate: null,
        lastTechnicianName: null,
        canStartTreatment: true,
        message: 'אוטובוס חדש במערכת - מאושר לביצוע טיפול מונע'
      });
    }

    const evaluation = evaluateBusStatus(bus);

    res.json({
      exists: true,
      busNumber: bus.bus_number,
      status: evaluation.status,
      lastTreatmentDate: bus.last_treatment_date || bus.report_created_at || null,
      nextTreatmentDate: bus.next_treatment_date || null,
      lastTechnicianName: bus.last_technician_name || null,
      lastResult: bus.last_result || null,
      lastReportId: bus.last_report_id || null,
      canStartTreatment: evaluation.canStartTreatment,
      blockReason: evaluation.blockReason,
      message: evaluation.message
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
