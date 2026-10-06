import crypto from 'node:crypto';

const COMMON_WEAK_PASSWORDS = new Set([
  '1234', '1111', '0000', '123456', '12345678', '123456789',
  'password', 'qwerty', 'admin', 'admin123', 'root', '123123',
  '112233', '987654321', '0123456789', 'tipulon', 'tipul123'
]);

/**
 * Validates password strength against security policy.
 * @param {string} password
 * @param {{ phone?: string, fullName?: string, role?: string }} context
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePasswordStrength(password, context = {}) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'נא להזין סיסמה' };
  }

  const clean = password.trim();

  // Minimum length check
  const minLen = context.role === 'admin' ? 8 : 6;
  if (clean.length < minLen) {
    return {
      valid: false,
      error: `הסיסמה חייבת להכיל לפחות ${minLen} תווים`
    };
  }

  if (clean.length > 64) {
    return {
      valid: false,
      error: 'הסיסמה ארוכה מדי (מקסימום 64 תווים)'
    };
  }

  const lower = clean.toLowerCase();

  // Check common weak passwords
  if (COMMON_WEAK_PASSWORDS.has(lower)) {
    return {
      valid: false,
      error: 'סיסמה זו פשוטה מדי ונפוצה. נא לבחור סיסמה חזקה יותר'
    };
  }

  // Check all identical characters (e.g. 222222, aaaaaa)
  if (/^(.)\1+$/.test(clean)) {
    return {
      valid: false,
      error: 'הסיסמה אינה יכולה להכיל רק תווים זהים ברצף'
    };
  }

  // Check sequential digits (e.g. 123456, 654321)
  if (/^(0123456789|9876543210)/.test(clean)) {
    return {
      valid: false,
      error: 'הסיסמה אינה יכולה להיות רצף ספרות פשוט'
    };
  }

  // Check if password equals phone number or contains phone digits
  if (context.phone) {
    const cleanPhone = String(context.phone).replace(/[^0-9]/g, '');
    if (cleanPhone && (clean === cleanPhone || (cleanPhone.length >= 6 && clean.includes(cleanPhone)))) {
      return {
        valid: false,
        error: 'הסיסמה אינה יכולה להכיל את מספר הטלפון של המשתמש'
      };
    }
  }

  // Check if password matches user's full name
  if (context.fullName) {
    const cleanName = String(context.fullName).trim().toLowerCase();
    if (cleanName && cleanName.length >= 3 && lower === cleanName) {
      return {
        valid: false,
        error: 'הסיסמה אינה יכולה להיות זהה לשם המשתמש'
      };
    }
  }

  return { valid: true };
}

/**
 * Generates a high-entropy, readable 12-character temporary password.
 * Format: 3 groups separated by hyphens (e.g. W9x-kP4m-7Qr2)
 * @returns {string}
 */
export function generateSecureTempPassword() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const getRandomChars = (count) => {
    const bytes = crypto.randomBytes(count);
    let result = '';
    for (let i = 0; i < count; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  };

  return `${getRandomChars(4)}-${getRandomChars(4)}-${getRandomChars(4)}`;
}
