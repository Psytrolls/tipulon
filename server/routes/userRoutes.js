import express from 'express';
import { db, normalizePhone, hashPin, logAudit } from '../db.js';
import { requireAdmin } from '../auth.js';
import { unlockUserPhone, isUserPhoneLocked } from '../securityService.js';

const router = express.Router();

// GET /api/users - List users (Admin only)
router.get('/', requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT id, full_name, phone, role, is_active, must_change_pin, created_at
      FROM users
      ORDER BY id ASC
    `);
    const users = stmt.all();
    const enrichedUsers = users.map(u => ({
      ...u,
      is_locked: isUserPhoneLocked(u.phone),
      must_change_pin: Boolean(u.must_change_pin)
    }));
    res.json(enrichedUsers);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
  }
});

// POST /api/users - Add user (Admin only)
router.post('/', requireAdmin, (req, res) => {
  try {
    const { fullName, phone, pin, role, mustChangePin } = req.body;

    const cleanName = String(fullName || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'נא להזין שם מלא' });
    }

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      return res.status(400).json({ error: 'מספר טלפון חייב להכיל בין 9 ל-15 ספרות' });
    }

    const cleanPin = String(pin || '').trim();
    if (cleanPin.length < 4 || cleanPin.length > 32) {
      return res.status(400).json({ error: 'קוד PIN / סיסמה חייבים להכיל בין 4 ל-32 תווים' });
    }

    const validRoles = ['technician', 'admin'];
    const chosenRole = role || 'technician';
    if (!validRoles.includes(chosenRole)) {
      return res.status(400).json({ error: 'תפקיד לא חוקי (בחר טכנאי או מנהל)' });
    }

    // Check duplicate phone
    const checkStmt = db.prepare('SELECT id FROM users WHERE phone = ?');
    const existing = checkStmt.get(cleanPhone);
    if (existing) {
      return res.status(400).json({ error: 'קיים כבר משתמש פעיל עם מספר טלפון זה' });
    }

    const { hash, salt } = hashPin(cleanPin);
    const forceChange = mustChangePin !== undefined ? (mustChangePin ? 1 : 0) : 1;

    const insertStmt = db.prepare(`
      INSERT INTO users (full_name, phone, pin_hash, pin_salt, role, is_active, must_change_pin)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    const result = insertStmt.run(cleanName, cleanPhone, hash, salt, chosenRole, forceChange);

    const newUserId = Number(result.lastInsertRowid);
    const roleHebrew = chosenRole === 'admin' ? 'מנהל' : 'טכנאי';
    logAudit(req.user.id, req.user.fullName, 'הוספת משתמש', 'משתמש', newUserId, `נוסף משתמש: ${cleanName} (${cleanPhone}), תפקיד: ${roleHebrew}`);

    res.status(201).json({
      id: newUserId,
      full_name: cleanName,
      phone: cleanPhone,
      role: chosenRole,
      is_active: 1,
      must_change_pin: forceChange === 1
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת משתמש חדש' });
  }
});

// PATCH /api/users/:id/role - Change user role (Admin only)
router.patch('/:id/role', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (role !== 'technician' && role !== 'admin') {
      return res.status(400).json({ error: 'תפקיד לא חוקי' });
    }

    const checkStmt = db.prepare('SELECT id, full_name, role FROM users WHERE id = ?');
    const user = checkStmt.get(id);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    const updateStmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    updateStmt.run(role, id);

    const roleHebrew = role === 'admin' ? 'מנהל' : 'טכנאי';
    logAudit(req.user.id, req.user.fullName, 'שינוי תפקיד', 'משתמש', id, `תפקיד שונה ל: ${roleHebrew}`);

    res.json({ success: true, id: Number(id), role });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ error: 'שגיאה בעדכון תפקיד משתמש' });
  }
});

// PATCH /api/users/:id/toggle - Toggle user active/inactive
router.patch('/:id/toggle', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === req.user.id) {
      return res.status(400).json({ error: 'לא ניתן להשבית את המשתמש הנוכחי של עצמך' });
    }

    const checkStmt = db.prepare('SELECT id, full_name, is_active FROM users WHERE id = ?');
    const user = checkStmt.get(id);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    const newActive = user.is_active ? 0 : 1;
    const updateStmt = db.prepare('UPDATE users SET is_active = ? WHERE id = ?');
    updateStmt.run(newActive, id);

    const statusText = newActive ? 'הופעל' : 'הושבת';
    logAudit(req.user.id, req.user.fullName, 'שינוי סטטוס פעילות', 'משתמש', id, `משתמש ${statusText}`);

    res.json({ success: true, id: Number(id), is_active: newActive });
  } catch (err) {
    console.error('Toggle user active error:', err);
    res.status(500).json({ error: 'שגיאה בשינוי סטטוס משתמש' });
  }
});

// PATCH /api/users/:id/pin - Change user PIN / Password (Admin can change any user's PIN)
router.patch('/:id/pin', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { newPin, mustChangePin } = req.body;

    const cleanPin = String(newPin || '').trim();
    if (cleanPin.length < 4 || cleanPin.length > 32) {
      return res.status(400).json({ error: 'קוד PIN / סיסמה חייבים להכיל בין 4 ל-32 תווים' });
    }

    const checkStmt = db.prepare('SELECT id, full_name, phone FROM users WHERE id = ?');
    const targetUser = checkStmt.get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    const { hash, salt } = hashPin(cleanPin);
    const forceChange = mustChangePin !== undefined ? (mustChangePin ? 1 : 0) : 1;

    const updateStmt = db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, must_change_pin = ? WHERE id = ?');
    updateStmt.run(hash, salt, forceChange, id);

    // Auto-unlock user so technician can log in immediately with new PIN
    unlockUserPhone(targetUser.phone);

    logAudit(
      req.user.id,
      req.user.fullName,
      'שינוי סיסמה ושחרור נעילה',
      'משתמש',
      id,
      `עודכנה סיסמה ושוחררה חסימת אבטחה עבור: ${targetUser.full_name} (${targetUser.phone})`
    );

    res.json({ success: true, message: 'הסיסמה עודכנה והנעילה שוחררה בהצלחה' });
  } catch (err) {
    console.error('Update PIN error:', err);
    res.status(500).json({ error: 'שגיאה בעדכון קוד PIN' });
  }
});

// POST /api/users/:id/unlock - Manually unlock user account (Admin only)
router.post('/:id/unlock', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const checkStmt = db.prepare('SELECT id, full_name, phone FROM users WHERE id = ?');
    const targetUser = checkStmt.get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    unlockUserPhone(targetUser.phone);

    logAudit(
      req.user.id,
      req.user.fullName,
      'ביטול נעילת חשבון',
      'משתמש',
      id,
      `שוחררה חסימת אבטחה עבור: ${targetUser.full_name} (${targetUser.phone})`
    );

    res.json({ success: true, message: 'נעילת החשבון שוחררה בהצלחה' });
  } catch (err) {
    console.error('Unlock user error:', err);
    res.status(500).json({ error: 'שגיאה בשחרור נעילת המשתמש' });
  }
});

// PATCH /api/users/:id/details - Update full name or phone number
router.patch('/:id/details', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone } = req.body;

    const cleanName = String(fullName || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'שם מלא הוא שדה חובה' });
    }

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      return res.status(400).json({ error: 'מספר טלפון חייב להכיל בין 9 ל-15 ספרות' });
    }

    // Check if phone already taken by someone else
    const phoneCheckStmt = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?');
    const existing = phoneCheckStmt.get(cleanPhone, id);
    if (existing) {
      return res.status(400).json({ error: 'מספר טלפון זה כבר קיים במערכת' });
    }

    const updateStmt = db.prepare('UPDATE users SET full_name = ?, phone = ? WHERE id = ?');
    updateStmt.run(cleanName, cleanPhone, id);

    logAudit(
      req.user.id,
      req.user.fullName,
      'עדכון פרטי משתמש',
      'משתמש',
      id,
      `פרטי משתמש עודכנו ל: ${cleanName}, טלפון: ${cleanPhone}`
    );

    res.json({ success: true, id: Number(id), full_name: cleanName, phone: cleanPhone });
  } catch (err) {
    console.error('Update user details error:', err);
    res.status(500).json({ error: 'שגיאה בעדכון פרטי משתמש' });
  }
});

export default router;
