import express from 'express';
import { db, logAudit } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = express.Router();

// GET /api/admin/dashboard - Dashboard KPIs
router.get('/dashboard', requireAdmin, (req, res) => {
  try {
    // 1. Treatments today
    const todayStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE date(created_at) = date('now')
    `);
    const treatmentsToday = todayStmt.get().count;

    // Total reports filed in the system
    const totalReports = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;

    // Total fleet size from buses table
    const totalFleet = db.prepare('SELECT COUNT(*) as count FROM buses').get().count;
    const totalDanBaDarom = db.prepare("SELECT COUNT(*) as count FROM buses WHERE operator = 'דן בדרום'").get().count;
    const totalDanBeerSheva = db.prepare("SELECT COUNT(*) as count FROM buses WHERE operator = 'דן באר שבע'").get().count;

    // 2. Total completed treatments
    const totalCompletedStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE status = 'הטיפול הושלם'
    `);
    const totalCompleted = totalCompletedStmt.get().count;

    // 3. Completed for Dan BaDarom
    const danBaDaromStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE operator = 'דן בדרום' AND status = 'הטיפול הושלם'
    `);
    const completedDanBaDarom = danBaDaromStmt.get().count;

    // 4. Completed for Dan Beer Sheva
    const danBeerShevaStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE operator = 'דן באר שבע' AND status = 'הטיפול הושלם'
    `);
    const completedDanBeerSheva = danBeerShevaStmt.get().count;

    // 5. Total Closed in EDI
    const ediClosedStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE is_edi_closed = 1
    `);
    const ediClosed = ediClosedStmt.get().count;

    // 6. Total Open in EDI (Awaiting closure: completed + follow-up queue)
    const ediOpenStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE is_edi_closed = 0 OR is_edi_closed IS NULL
    `);
    const ediOpen = ediOpenStmt.get().count;

    // 7. Treatment needed
    const neededStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM buses 
      WHERE status = 'נדרש טיפול'
    `);
    const treatmentNeeded = neededStmt.get().count;

    // 8. Follow-up queue
    const followUpStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM buses 
      WHERE status = 'הועבר להמשך טיפול'
    `);
    const followUpQueue = followUpStmt.get().count;

    // 9. Overdue
    const overdueStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM buses 
      WHERE next_treatment_date IS NOT NULL 
        AND datetime(next_treatment_date) < datetime('now')
    `);
    const overdue = overdueStmt.get().count;

    // Recent 5 reports
    const recentReportsStmt = db.prepare(`
      SELECT id, bus_number, operator, technician_name, result, status, is_edi_closed, created_at
      FROM reports
      ORDER BY id DESC
      LIMIT 5
    `);
    const recentReports = recentReportsStmt.all();

    res.json({
      metrics: {
        totalReports,
        totalFleet,
        totalDanBaDarom,
        totalDanBeerSheva,
        treatmentsToday,
        totalCompleted,
        completedDanBaDarom,
        completedDanBeerSheva,
        ediClosed,
        ediOpen,
        treatmentNeeded,
        followUpQueue,
        overdue
      },
      recentReports
    });
  } catch (err) {
    console.error('Dashboard metrics error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת מדדי לוח בקרה' });
  }
});

// GET /api/admin/follow-up-queue - Buses requiring client follow-up
router.get('/follow-up-queue', requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT b.bus_number, b.updated_at,
             r.id as report_id, r.technician_name, r.summary, r.created_at as treatment_date, r.photo_path
      FROM buses b
      JOIN reports r ON r.bus_number = b.bus_number AND r.status = 'הועבר להמשך טיפול'
      WHERE b.status = 'הועבר להמשך טיפול'
      ORDER BY r.created_at DESC
    `);
    const queue = stmt.all();
    res.json(queue);
  } catch (err) {
    console.error('Follow-up queue error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת תור המשך טיפול' });
  }
});

// POST /api/admin/resolve-follow-up - Resolve follow-up status
router.post('/resolve-follow-up', requireAdmin, (req, res) => {
  try {
    const { busNumber, resolutionNotes } = req.body;
    if (!busNumber) {
      return res.status(400).json({ error: 'נא להזין מספר אוטובוס' });
    }

    const stmt = db.prepare(`
      UPDATE buses 
      SET status = 'הטיפול הושלם', updated_at = datetime('now')
      WHERE bus_number = ?
    `);
    stmt.run(busNumber);

    logAudit(
      req.user.id,
      req.user.fullName,
      'סגירת המשך טיפול',
      'אוטובוס',
      busNumber,
      `המשך טיפול נסגר על ידי מנהל${resolutionNotes ? ': ' + resolutionNotes : ''}`
    );

    res.json({ success: true, busNumber });
  } catch (err) {
    console.error('Resolve follow-up error:', err);
    res.status(500).json({ error: 'שגיאה בעדכון סטטוס' });
  }
});

// GET /api/admin/audit-logs - System Audit Logs
router.get('/audit-logs', requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT id, user_id, user_name, action, entity, entity_id, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 150
    `);
    const logs = stmt.all();
    res.json(logs);
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת יומן פעולות' });
  }
});

// ==========================================
// Database Backup Endpoints
// ==========================================
import { createBackup, listBackups, getLatestBackupPath } from '../backupService.js';
import path from 'node:path';
import fs from 'node:fs';

// GET /api/admin/backups - List backups
router.get('/backups', requireAdmin, (req, res) => {
  try {
    const backups = listBackups();
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בטעינת רשימת הגיבויים' });
  }
});

// POST /api/admin/backups/create - Create backup now
router.post('/backups/create', requireAdmin, async (req, res) => {
  try {
    const result = await createBackup({ reason: 'יזום על ידי מנהל' });
    logAudit(
      req.user.id,
      req.user.fullName,
      'יצירת גיבוי ידני',
      'מסד נתונים',
      result.filename,
      `נוצר קובץ גיבוי בגודל ${result.sizeFormatted}`
    );
    res.json(result);
  } catch (err) {
    console.error('Manual backup error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת גיבוי' });
  }
});

// GET /api/admin/backups/download-latest - Download latest backup file
router.get('/backups/download-latest', requireAdmin, (req, res) => {
  try {
    const latestPath = getLatestBackupPath();
    if (!latestPath || !fs.existsSync(latestPath)) {
      return res.status(404).json({ error: 'לא נמצא קובץ גיבוי להורדה' });
    }
    const filename = path.basename(latestPath);
    res.download(latestPath, filename);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בהורדת קובץ הגיבוי' });
  }
});

// GET /api/admin/backups/download/:filename - Download specific backup file
router.get('/backups/download/:filename', requireAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const latestPath = getLatestBackupPath();
    const backupsDir = latestPath ? path.dirname(latestPath) : null;
    
    if (!backupsDir) {
      return res.status(404).json({ error: 'תיקיית גיבויים ריקה' });
    }

    const targetFile = path.join(backupsDir, safeFilename);
    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: 'קובץ הגיבוי המבוקש לא קיים' });
    }

    res.download(targetFile, safeFilename);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בהורדת קובץ הגיבוי' });
  }
});

export default router;
