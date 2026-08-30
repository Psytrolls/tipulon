import crypto from 'node:crypto';
import { db } from './db.js';

export function createSession(userId, daysValid = 30) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(token, userId, expiresAt.toISOString());

  return { token, expiresAt };
}

export function deleteSession(token) {
  if (!token) return;
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}

export function authenticateUser(req, res, next) {
  const token = req.cookies?.tipulon_session;

  if (!token) {
    req.user = null;
    return next();
  }

  const stmt = db.prepare(`
    SELECT u.id, u.full_name, u.phone, u.role, u.is_active, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
  `);

  const user = stmt.get(token);

  if (!user || !user.is_active) {
    req.user = null;
  } else {
    req.user = {
      id: user.id,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role
    };
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'משתמש אינו מחובר למערכת' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'משתמש אינו מחובר למערכת' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'אין לך הרשאת מנהל לביצוע פעולה זו' });
  }
  next();
}
