/**
 * Safe Production Logging Utility
 * Strips secrets, tokens, passwords, cookies, and keys from all logs.
 */

const SENSITIVE_KEYS = new Set([
  'password', 'pin', 'token', 'token_hash', 'secret', 'session_secret',
  'backup_encryption_key', 'cookie', 'tipulon_session', 'pass', 'smtp_pass',
  'authorization', 'auth'
]);

function sanitizeData(data, depth = 0) {
  if (depth > 4) return '[Deep Object]';
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('pass') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('cookie')) {
      clean[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeData(value, depth + 1);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function safeLog(message, data = null) {
  if (data !== null && data !== undefined) {
    console.log(message, sanitizeData(data));
  } else {
    console.log(message);
  }
}

export function safeWarn(message, data = null) {
  if (data !== null && data !== undefined) {
    console.warn(message, sanitizeData(data));
  } else {
    console.warn(message);
  }
}

export function safeError(message, err = null) {
  if (!err) {
    console.error(message);
    return;
  }

  if (err instanceof Error) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`${message} | Error: ${err.message}`);
    } else {
      console.error(`${message}:`, err.stack || err.message);
    }
  } else {
    console.error(message, sanitizeData(err));
  }
}
