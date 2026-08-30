import express from 'express';
import { db, normalizePhone, verifyPin, logAudit } from '../db.js';
import { createSession, deleteSession } from '../auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ error: 'נא להזין מספר טלפון וקוד PIN' });
    }

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      return res.status(400).json({ error: 'מספר טלפון חייב להכיל בין 9 ל-15 ספרות' });
    }

    const cleanPin = String(pin).trim();
    if (cleanPin.length < 4 || cleanPin.length > 8 || !/^\d+$/.test(cleanPin)) {
      return res.status(400).json({ error: 'קוד PIN חייב להכיל 4 עד 8 ספרות' });
    }

    const stmt = db.prepare(`
      SELECT id, full_name, phone, pin_hash, pin_salt, role, is_active
      FROM users
      WHERE phone = ?
    `);

    const user = stmt.get(cleanPhone);

    // Constant-time-like rejection for security
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'פרטי התחברות שגויים או משתמש לא פעיל' });
    }

    const isValid = verifyPin(cleanPin, user.pin_salt, user.pin_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'פרטי התחברות שגויים' });
    }

    // Create session
    const session = createSession(user.id, 30);

    // Set cookie
    res.cookie('tipulon_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    logAudit(user.id, user.full_name, 'התחברות', 'משתמש', user.id, 'התחברות מוצלחת למערכת');

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'שגיאה פנימית בהתחברות' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: req.user
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.cookies?.tipulon_session;
  if (token) {
    deleteSession(token);
    res.clearCookie('tipulon_session');
  }
  if (req.user) {
    logAudit(req.user.id, req.user.fullName, 'התנתקות', 'משתמש', req.user.id, 'התנתקות מהמערכת');
  }
  res.json({ success: true });
});

export default router;
