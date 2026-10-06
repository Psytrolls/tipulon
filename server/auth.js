import crypto from 'node:crypto';
import { db } from './db.js';

/**
 * Computes SHA-256 hash of a session token for secure database storage.
 */
export function hashSessionToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Creates a new secure session with SHA-256 hashed token storage.
 * Admins: 24-hour expiration.
 * Technicians: 7-day expiration.
 */
export function createSession(userId, role = 'technician') {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);

  const isAdmin = role === 'admin';
  const durationMs = isAdmin ? (24 * 60 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000); // 24h for admin, 7d for tech
  const expiresAt = new Date(Date.now() + durationMs);

  const stmt = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(tokenHash, userId, expiresAt.toISOString());

  return {
    token: rawToken,
    expiresAt,
    maxAgeMs: durationMs
  };
}

export function deleteSession(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  const stmt = db.prepare('DELETE FROM sessions WHERE token_hash = ? OR token_hash = ?');
  stmt.run(tokenHash, rawToken);
}

// Periodic cleanup of expired sessions (runs every hour)
setInterval(() => {
  try {
    db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')").run();
  } catch (err) {
    console.error('[AUTH] Expired sessions cleanup error:', err);
  }
}, 60 * 60 * 1000).unref();

export function authenticateUser(req, res, next) {
  const rawToken = req.cookies?.tipulon_session;

  if (!rawToken) {
    req.user = null;
    return next();
  }

  const tokenHash = hashSessionToken(rawToken);

  const stmt = db.prepare(`
    SELECT u.id, u.full_name, u.phone, u.role, u.is_active, u.is_super_admin, u.must_change_pin, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE (s.token_hash = ? OR s.token_hash = ?) AND datetime(s.expires_at) > datetime('now')
  `);

  const user = stmt.get(tokenHash, rawToken);

  if (!user || !user.is_active) {
    req.user = null;
  } else {
    req.user = {
      id: user.id,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role,
      isSuperAdmin: Boolean(user.is_super_admin),
      mustChangePin: Boolean(user.must_change_pin)
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

export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'משתמש אינו מחובר למערכת' });
  }
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'פעולה זו מורשית למנהל העל (Super Admin) בלבד' });
  }
  next();
}

/**
 * Enforces server-side mandatory password change.
 * If user has mustChangePin = true, only allow /api/auth/me, /api/auth/change-password, /api/auth/logout.
 */
export function mustChangePinGuard(req, res, next) {
  if (req.user && req.user.mustChangePin) {
    const url = req.originalUrl || req.url || '';
    const isAllowedAuthEndpoint = (
      url.startsWith('/api/auth/me') ||
      url.startsWith('/api/auth/change-password') ||
      url.startsWith('/api/auth/logout')
    );

    if (url.startsWith('/api/') && !isAllowedAuthEndpoint) {
      return res.status(403).json({
        error: 'חובה לעדכן סיסמה לפני המשך שימוש במערכת',
        mustChangePin: true
      });
    }
  }
  next();
}

