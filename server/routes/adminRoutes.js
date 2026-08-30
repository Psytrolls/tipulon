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

    // 2. Treatment needed
    const neededStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM buses 
      WHERE status = 'נדרש טיפול'
    `);
    const treatmentNeeded = neededStmt.get().count;

    // 3. Follow-up queue
    const followUpStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM buses 
      WHERE status = 'הועבר להמשך טיפול'
    `);
    const followUpQueue = followUpStmt.get().count;

    // 4. Overdue
    const overdueStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM buses 
      WHERE next_treatment_date IS NOT NULL 
        AND datetime(next_treatment_date) < datetime('now')
    `);
    const overdue = overdueStmt.get().count;

    // Recent 5 reports
    const recentReportsStmt = db.prepare(`
      SELECT id, bus_number, technician_name, result, status, created_at
      FROM reports
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const recentReports = recentReportsStmt.all();

    res.json({
      metrics: {
        treatmentsToday,
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

export default router;
