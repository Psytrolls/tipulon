import { db } from './db.js';

// Configuration
const MAX_FAILED_PER_PHONE = 5;              // Lockout after 5 consecutive failed attempts per phone
const MAX_FAILED_PER_IP = 25;                // Max 25 failed attempts per IP across any accounts
const MAX_FAILED_PER_IP_PHONE = 5;           // Max 5 failed attempts for specific IP + Phone
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;  // 15 minutes lock
const WINDOW_DURATION_MS = 15 * 60 * 1000;   // 15 minutes window

// Prepared statements for high-performance rate limiting
const getLockoutStmt = db.prepare(`
  SELECT locked_until, reason 
  FROM security_lockouts 
  WHERE target_type = ? AND target_value = ?
`);

const setLockoutStmt = db.prepare(`
  INSERT INTO security_lockouts (target_type, target_value, locked_until, reason)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(target_type, target_value) DO UPDATE SET
    locked_until = excluded.locked_until,
    reason = excluded.reason
`);

const deleteLockoutStmt = db.prepare(`
  DELETE FROM security_lockouts 
  WHERE target_type = ? AND target_value = ?
`);

const insertAttemptStmt = db.prepare(`
  INSERT INTO login_attempts (ip, phone, attempted_at, is_success)
  VALUES (?, ?, ?, ?)
`);

const countRecentFailuresPhoneStmt = db.prepare(`
  SELECT COUNT(*) as count 
  FROM login_attempts 
  WHERE phone = ? AND is_success = 0 AND attempted_at >= ?
`);

const countRecentFailuresIpStmt = db.prepare(`
  SELECT COUNT(*) as count 
  FROM login_attempts 
  WHERE ip = ? AND is_success = 0 AND attempted_at >= ?
`);

const countRecentFailuresIpPhoneStmt = db.prepare(`
  SELECT COUNT(*) as count 
  FROM login_attempts 
  WHERE ip = ? AND phone = ? AND is_success = 0 AND attempted_at >= ?
`);

const clearSuccessAttemptsStmt = db.prepare(`
  DELETE FROM login_attempts 
  WHERE phone = ? AND attempted_at < ?
`);

// Periodic cleanup of expired lockouts and old login attempts (every 10 minutes)
setInterval(() => {
  try {
    const now = Date.now();
    const purgeBefore = now - (24 * 60 * 60 * 1000); // 24 hours
    db.prepare('DELETE FROM security_lockouts WHERE locked_until < ?').run(now);
    db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(purgeBefore);
  } catch (err) {
    console.error('[SECURITY] Cleanup error:', err);
  }
}, 10 * 60 * 1000).unref();

/**
 * Accurately extracts the client IP address using Express req.ip (trusted proxy configured).
 */
export function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Checks whether login is permitted for the given phone number and client IP.
 * Persistent in SQLite database across container restarts.
 * @returns {{ allowed: boolean, status?: number, error?: string }}
 */
export function checkLoginRateLimit(phone, ip) {
  const now = Date.now();

  try {
    // 1. Check IP lock
    if (ip) {
      const ipLock = getLockoutStmt.get('ip', ip);
      if (ipLock && ipLock.locked_until > now) {
        const minutesLeft = Math.ceil((ipLock.locked_until - now) / 60000);
        return {
          allowed: false,
          status: 429,
          error: `בוצעו יותר מדי ניסיונות התחברות מכתובת זו. המערכת חסומה לעוד ${minutesLeft} דקות.`
        };
      }
    }

    // 2. Check Phone lock
    if (phone) {
      const phoneLock = getLockoutStmt.get('phone', phone);
      if (phoneLock && phoneLock.locked_until > now) {
        const minutesLeft = Math.ceil((phoneLock.locked_until - now) / 60000);
        return {
          allowed: false,
          status: 429,
          error: `החשבון ננעל זמנית עקב מספר ניסיונות שגויים ברצף. נסה שוב בעוד ${minutesLeft} דקות.`
        };
      }

      // 3. Check combined IP + Phone lock
      if (ip) {
        const comboLock = getLockoutStmt.get('ip_phone', `${ip}:${phone}`);
        if (comboLock && comboLock.locked_until > now) {
          const minutesLeft = Math.ceil((comboLock.locked_until - now) / 60000);
          return {
            allowed: false,
            status: 429,
            error: `החשבון ננעל זמנית מכתובת זו. נסה שוב בעוד ${minutesLeft} דקות.`
          };
        }
      }
    }
  } catch (err) {
    console.error('[SECURITY] checkLoginRateLimit error:', err);
  }

  return { allowed: true };
}

/**
 * Records a failed login attempt for phone and IP and applies persistent lockouts.
 * @returns {{ isLocked: boolean, attemptsLeft: number, lockMinutes: number }}
 */
export function recordFailedLogin(phone, ip) {
  const now = Date.now();
  const windowStart = now - WINDOW_DURATION_MS;
  let isLocked = false;
  let attemptsLeft = MAX_FAILED_PER_PHONE;
  const lockUntil = now + LOCKOUT_DURATION_MS;
  const lockMinutes = Math.ceil(LOCKOUT_DURATION_MS / 60000);

  try {
    // 1. Record attempt in database
    insertAttemptStmt.run(ip || '127.0.0.1', phone || '', now, 0);

    // 2. Evaluate Phone failures
    if (phone) {
      const phoneFailures = countRecentFailuresPhoneStmt.get(phone, windowStart)?.count || 1;
      if (phoneFailures >= MAX_FAILED_PER_PHONE) {
        setLockoutStmt.run('phone', phone, lockUntil, `5 failed attempts within ${lockMinutes}m`);
        isLocked = true;
        attemptsLeft = 0;
      } else {
        attemptsLeft = Math.max(0, MAX_FAILED_PER_PHONE - phoneFailures);
      }
    }

    // 3. Evaluate IP failures
    if (ip) {
      const ipFailures = countRecentFailuresIpStmt.get(ip, windowStart)?.count || 1;
      if (ipFailures >= MAX_FAILED_PER_IP) {
        setLockoutStmt.run('ip', ip, lockUntil, `25 failed attempts within ${lockMinutes}m across IP`);
        isLocked = true;
      }

      // 4. Evaluate combined IP + Phone failures
      if (phone) {
        const comboFailures = countRecentFailuresIpPhoneStmt.get(ip, phone, windowStart)?.count || 1;
        if (comboFailures >= MAX_FAILED_PER_IP_PHONE) {
          setLockoutStmt.run('ip_phone', `${ip}:${phone}`, lockUntil, `5 failed attempts from IP for phone`);
          isLocked = true;
        }
      }
    }
  } catch (err) {
    console.error('[SECURITY] recordFailedLogin error:', err);
  }

  return {
    isLocked,
    attemptsLeft,
    lockMinutes
  };
}

/**
 * Resets failed attempts and unlocks phone upon successful login.
 */
export function recordSuccessfulLogin(phone, ip) {
  const now = Date.now();
  try {
    if (phone) {
      insertAttemptStmt.run(ip || '127.0.0.1', phone, now, 1);
      clearSuccessAttemptsStmt.run(phone, now);
      deleteLockoutStmt.run('phone', phone);
      if (ip) {
        deleteLockoutStmt.run('ip_phone', `${ip}:${phone}`);
      }
    }
  } catch (err) {
    console.error('[SECURITY] recordSuccessfulLogin error:', err);
  }
}

/**
 * Manually unlocks a user's phone number (called by admin when resetting PIN or unlocking user).
 */
export function unlockUserPhone(phone) {
  if (phone) {
    try {
      deleteLockoutStmt.run('phone', phone);
      db.prepare("DELETE FROM security_lockouts WHERE target_type = 'ip_phone' AND target_value LIKE '%:' || ?").run(phone);
      db.prepare('DELETE FROM login_attempts WHERE phone = ?').run(phone);
    } catch (err) {
      console.error('[SECURITY] unlockUserPhone error:', err);
    }
  }
}

/**
 * Checks if a specific phone number is currently locked out.
 */
export function isUserPhoneLocked(phone) {
  if (!phone) return false;
  try {
    const phoneLock = getLockoutStmt.get('phone', phone);
    return Boolean(phoneLock && phoneLock.locked_until > Date.now());
  } catch {
    return false;
  }
}

/**
 * Security HTTP headers middleware
 */
export function securityHeadersMiddleware(req, res, next) {
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS (HTTP Strict Transport Security) - 1 year
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Permissions Policy - allow camera for bus OCR scanner
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

  // Cache Control for API routes to prevent sensitive data caching
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}
