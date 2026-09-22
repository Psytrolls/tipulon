import crypto from 'node:crypto';

// Configuration
const MAX_FAILED_PER_PHONE = 5;              // Lockout after 5 consecutive failed attempts
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lock
const WINDOW_DURATION_MS = 15 * 60 * 1000;  // 15 minutes window

const MAX_FAILED_PER_IP = 25;               // Max 25 failed attempts per IP across any accounts

// In-memory rate limiting stores
// phoneAttempts: Map<string, { count: number, firstAttempt: number, lockUntil: number | null }>
const phoneAttempts = new Map();
// ipAttempts: Map<string, { count: number, firstAttempt: number, lockUntil: number | null }>
const ipAttempts = new Map();

// Periodic cleanup every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of phoneAttempts.entries()) {
    if (data.lockUntil && data.lockUntil < now) {
      phoneAttempts.delete(phone);
    } else if (!data.lockUntil && (now - data.firstAttempt) > WINDOW_DURATION_MS) {
      phoneAttempts.delete(phone);
    }
  }

  for (const [ip, data] of ipAttempts.entries()) {
    if (data.lockUntil && data.lockUntil < now) {
      ipAttempts.delete(ip);
    } else if (!data.lockUntil && (now - data.firstAttempt) > WINDOW_DURATION_MS) {
      ipAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Checks whether login is permitted for the given phone number and client IP.
 * @returns {{ allowed: boolean, status?: number, error?: string }}
 */
export function checkLoginRateLimit(phone, ip) {
  const now = Date.now();

  // 1. Check IP lock
  const ipData = ipAttempts.get(ip);
  if (ipData?.lockUntil && ipData.lockUntil > now) {
    const minutesLeft = Math.ceil((ipData.lockUntil - now) / 60000);
    return {
      allowed: false,
      status: 429,
      error: `בוצעו יותר מדי ניסיונות התחברות מכתובת זו. המערכת חסומה לעוד ${minutesLeft} דקות.`
    };
  }

  // 2. Check Phone lock
  if (phone) {
    const phoneData = phoneAttempts.get(phone);
    if (phoneData?.lockUntil && phoneData.lockUntil > now) {
      const minutesLeft = Math.ceil((phoneData.lockUntil - now) / 60000);
      return {
        allowed: false,
        status: 429,
        error: `החשבון ננעל זמנית עקב 5 ניסיונות שגויים ברצף. נסה שוב בעוד ${minutesLeft} דקות.`
      };
    }
  }

  return { allowed: true };
}

/**
 * Records a failed login attempt for phone and IP.
 * @returns {{ isLocked: boolean, attemptsLeft: number, lockMinutes: number }}
 */
export function recordFailedLogin(phone, ip) {
  const now = Date.now();
  let isLocked = false;
  let attemptsLeft = MAX_FAILED_PER_PHONE;

  // Track Phone
  if (phone) {
    let pData = phoneAttempts.get(phone);
    if (!pData || (now - pData.firstAttempt) > WINDOW_DURATION_MS) {
      pData = { count: 1, firstAttempt: now, lockUntil: null };
    } else {
      pData.count += 1;
    }

    if (pData.count >= MAX_FAILED_PER_PHONE) {
      pData.lockUntil = now + LOCKOUT_DURATION_MS;
      isLocked = true;
      attemptsLeft = 0;
    } else {
      attemptsLeft = MAX_FAILED_PER_PHONE - pData.count;
    }

    phoneAttempts.set(phone, pData);
  }

  // Track IP
  if (ip) {
    let iData = ipAttempts.get(ip);
    if (!iData || (now - iData.firstAttempt) > WINDOW_DURATION_MS) {
      iData = { count: 1, firstAttempt: now, lockUntil: null };
    } else {
      iData.count += 1;
    }

    if (iData.count >= MAX_FAILED_PER_IP) {
      iData.lockUntil = now + LOCKOUT_DURATION_MS;
    }

    ipAttempts.set(ip, iData);
  }

  return {
    isLocked,
    attemptsLeft,
    lockMinutes: Math.ceil(LOCKOUT_DURATION_MS / 60000)
  };
}

/**
 * Resets failed attempts for a successfully logged in phone.
 */
export function recordSuccessfulLogin(phone, ip) {
  if (phone) {
    phoneAttempts.delete(phone);
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
