/**
 * Validators for Tipulon System
 * Enforces business rules and fool-proof data entry constraints
 */

// 1. Bus Number / Israeli License Plate Validator
export function validateBusNumber(busNumber) {
  if (!busNumber) {
    return 'חובה להזין מספר אוטובוס (לוחית רישוי)';
  }

  const clean = String(busNumber).replace(/[^0-9]/g, '').trim();

  // Length constraint: strictly 7 or 8 digits
  if (clean.length < 7 || clean.length > 8) {
    return 'מספר אוטובוס אינו תקין: חייב להכיל בדיוק 7 או 8 ספרות';
  }

  // Cannot start with 0 (Israeli plates never start with 0)
  if (clean.startsWith('0')) {
    return 'מספר אוטובוס אינו תקין: לא יכול להתחיל בספרה 0';
  }

  // Cannot be all identical digits (e.g. 1111111, 2222222, 99999999)
  if (new Set(clean).size === 1) {
    return 'מספר אוטובוס לא תקין: לא ניתן להזין רצף של ספרות זהות (לדוגמה: 2222222)';
  }

  // Cannot consist only of zeros and ones (e.g. 01010101, 10000000)
  if (clean.split('').every(c => c === '0' || c === '1')) {
    return 'מספר אוטובוס לא תקין: לא ניתן להזין רק אפסים ואחדים';
  }

  // Cannot be obvious test sequences (e.g. 1234567, 12345678, 87654321)
  const dummySequences = ['1234567', '12345678', '2345678', '3456789', '7654321', '87654321', '8765432'];
  if (dummySequences.includes(clean)) {
    return 'מספר אוטובוס לא תקין: לא ניתן להזין רצף עוקב של בדיקה (כגון 1234567)';
  }

  return null; // Valid!
}

// 2. Device Serial Number Validator
export function validateDeviceSerialNumber(serialNumber) {
  if (!serialNumber) {
    return 'חובה להזין מספר סידורי של המכשיר';
  }

  const clean = String(serialNumber).replace(/[^0-9]/g, '').trim();

  // Length constraint: strictly 3 to 4 digits
  if (clean.length < 3 || clean.length > 4) {
    return 'מספר מכשיר חייב להכיל בין 3 ל-4 ספרות בלבד (לדוגמה: 123 או 1234)';
  }

  // Cannot be all zeros (000, 0000)
  if (clean.split('').every(c => c === '0')) {
    return 'מספר מכשיר לא תקין: לא ניתן להזין רק אפסים (כגון 000 או 0000)';
  }

  return null; // Valid!
}
