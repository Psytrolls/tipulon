import express from 'express';
import crypto from 'node:crypto';
import { db, normalizePhone, hashPin, verifyPin, logAudit } from '../db.js';
import { createSession, deleteSession } from '../auth.js';
import {
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin
} from '../securityService.js';

const router = express.Router();

const DUMMY_SALT = 'tipulon_timing_dummy_salt_2026_x';

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { phone, pin } = req.body;
    const clientIp = getClientIp(req);

    if (!phone || !pin) {
      return res.status(400).json({ error: 'נא להזין מספר טלפון וקוד PIN' });
    }

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      return res.status(400).json({ error: 'מספר טלפון חייב להכיל בין 9 ל-15 ספרות' });
    }

    const cleanPin = String(pin).trim();
    if (cleanPin.length < 4 || cleanPin.length > 32) {
      return res.status(400).json({ error: 'קוד PIN / סיסמה חייבים להכיל 4 עד 32 תווים' });
    }

    // 1. Check Rate Limit / Account Lockout
    const rateLimit = checkLoginRateLimit(cleanPhone, clientIp);
    if (!rateLimit.allowed) {
      logAudit(
        0,
        'מערכת אבטחה',
        'ניסיון התחברות לחשבון נעול',
        'אבטחה',
        0,
        `ניסיון התחברות נדחה עקב נעילת חשבון. טלפון: ${cleanPhone}, IP: ${clientIp}`
      );
      return res.status(rateLimit.status || 429).json({ error: rateLimit.error });
    }

    const stmt = db.prepare(`
      SELECT id, full_name, phone, pin_hash, pin_salt, role, is_active, is_super_admin, must_change_pin
      FROM users
      WHERE phone = ?
    `);

    const user = stmt.get(cleanPhone);

    // Constant-time dummy hash if user not found to prevent timing attack enumeration
    if (!user || !user.is_active) {
      crypto.pbkdf2Sync(cleanPin, DUMMY_SALT, 10000, 64, 'sha512');
      const { isLocked, attemptsLeft, lockMinutes } = recordFailedLogin(cleanPhone, clientIp);

      logAudit(
        0,
        'משתמש לא ידוע',
        'ניסיון התחברות כושל',
        'אבטחה',
        0,
        `ניסיון התחברות למשתמש לא קיים/לא פעיל. טלפון: ${cleanPhone}, IP: ${clientIp}`
      );

      if (isLocked) {
        return res.status(429).json({
          error: `החשבון ננעל זמנית עקב 5 ניסיונות שגויים ברצף. נסה שוב בעוד ${lockMinutes} דקות.`
        });
      }

      return res.status(401).json({
        error: `פרטי התחברות שגויים. נותרו ${attemptsLeft} ניסיונות לפני נעילת החשבון.`
      });
    }

    const isValid = verifyPin(cleanPin, user.pin_salt, user.pin_hash);
    if (!isValid) {
      const { isLocked, attemptsLeft, lockMinutes } = recordFailedLogin(cleanPhone, clientIp);

      logAudit(
        user.id,
        user.full_name,
        isLocked ? 'חסימת חשבון זמנית' : 'ניסיון התחברות כושל',
        'אבטחה',
        user.id,
        isLocked
          ? `החשבון ננעל ל-15 דקות עקב 5 ניסיונות שגויים ברצף. IP: ${clientIp}`
          : `סיסמה שגויה עבור ${user.full_name}. נותרו ${attemptsLeft} ניסיונות. IP: ${clientIp}`
      );

      if (isLocked) {
        return res.status(429).json({
          error: `החשבון ננעל זמנית עקב 5 ניסיונות שגויים ברצף. נסה שוב בעוד ${lockMinutes} דקות.`
        });
      }

      return res.status(401).json({
        error: `קוד PIN / סיסמה שגויים. נותרו ${attemptsLeft} ניסיונות לפני נעילת החשבון.`
      });
    }

    // Reset failed attempts upon successful login
    recordSuccessfulLogin(cleanPhone, clientIp);

    // Create session
    const session = createSession(user.id, 30);

    const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';

    // Set secure cookie
    res.cookie('tipulon_session', session.token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    logAudit(user.id, user.full_name, 'התחברות', 'משתמש', user.id, `התחברות מוצלחת למערכת (IP: ${clientIp})`);

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        isSuperAdmin: Boolean(user.is_super_admin),
        mustChangePin: Boolean(user.must_change_pin)
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

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'משתמש אינו מחובר למערכת' });
  }

  try {
    const { currentPin, newPin } = req.body;

    if (!newPin) {
      return res.status(400).json({ error: 'נא להזין סיסמה חדשה' });
    }

    const cleanNewPin = String(newPin).trim();
    if (cleanNewPin.length < 6 || cleanNewPin.length > 32) {
      return res.status(400).json({ error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים (ועד 32 תווים)' });
    }

    const hasLetter = /[a-zA-Z]/.test(cleanNewPin);
    const hasDigit = /[0-9]/.test(cleanNewPin);
    if (!hasLetter || !hasDigit) {
      return res.status(400).json({ error: 'הסיסמה החדשה חייבת לכלול שילוב של אותיות באנגלית ומספרים (לדוגמה: Tipul123)' });
    }

    const stmt = db.prepare(`
      SELECT id, full_name, phone, pin_hash, pin_salt, must_change_pin
      FROM users
      WHERE id = ?
    `);
    const user = stmt.get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // If currentPin is provided and user is not in forced change mode, verify it
    if (currentPin && !user.must_change_pin) {
      const isValidCurrent = verifyPin(String(currentPin).trim(), user.pin_salt, user.pin_hash);
      if (!isValidCurrent) {
        return res.status(400).json({ error: 'הסיסמה הנוכחית שהוזנה אינה נכונה' });
      }
    }

    const { hash, salt } = hashPin(cleanNewPin);
    const updateStmt = db.prepare(`
      UPDATE users 
      SET pin_hash = ?, pin_salt = ?, must_change_pin = 0 
      WHERE id = ?
    `);
    updateStmt.run(hash, salt, req.user.id);

    logAudit(
      req.user.id,
      req.user.fullName,
      'החלפת סיסמה',
      'משתמש',
      req.user.id,
      'הסיסמה עודכנה בהצלחה (סיסמה מורכבת בתוקף)'
    );

    res.json({
      success: true,
      message: 'הסיסמה עודכנה בהצלחה!'
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'שגיאה פנימית בעדכון הסיסמה: ' + (err.message || '') });
  }
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
