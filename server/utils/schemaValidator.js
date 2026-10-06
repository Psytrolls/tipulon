/**
 * Centralized Schema Validation for Mutating API Routes
 */

import { validateBusNumber, validateDeviceSerialNumber } from '../validators.js';

export function validateBody(validatorFn) {
  return (req, res, next) => {
    try {
      const result = validatorFn(req.body);
      if (!result.valid) {
        return res.status(400).json({ error: result.error });
      }
      req.body = result.data;
      next();
    } catch {
      return res.status(400).json({ error: 'מבנה הבקשה אינו תקין' });
    }
  };
}

export function validateCreateUserSchema(body = {}) {
  const { phone, fullName, role, pin } = body;

  if (!phone || typeof phone !== 'string' || phone.trim().length < 9 || phone.trim().length > 15) {
    return { valid: false, error: 'מספר טלפון אינו תקין' };
  }

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 60) {
    return { valid: false, error: 'שם מלא חייב להכיל בין 2 ל-60 תווים' };
  }

  const validRoles = ['admin', 'technician'];
  if (role && !validRoles.includes(role)) {
    return { valid: false, error: 'תפקיד משתמש אינו מורשה' };
  }

  if (pin && typeof pin !== 'string') {
    return { valid: false, error: 'קוד PIN אינו תקין' };
  }

  return {
    valid: true,
    data: {
      phone: phone.trim(),
      fullName: fullName.trim(),
      role: role || 'technician',
      pin: pin ? String(pin).trim() : null
    }
  };
}

export function validateUpdateUserRoleSchema(body = {}) {
  const { role } = body;
  const validRoles = ['admin', 'technician'];
  if (!role || !validRoles.includes(role)) {
    return { valid: false, error: 'תפקיד משתמש אינו מורשה (בחר מנהל או טכנאי)' };
  }
  return {
    valid: true,
    data: { role }
  };
}

export function validateUpdateUserPinSchema(body = {}) {
  const { newPin, pin } = body;
  const targetPin = newPin !== undefined ? newPin : pin;

  if (targetPin !== undefined && targetPin !== null && targetPin !== '') {
    if (typeof targetPin !== 'string') {
      return { valid: false, error: 'קוד PIN אינו תקין' };
    }
    const cleanPin = targetPin.trim();
    if (cleanPin.length < 6) {
      return { valid: false, error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים' };
    }
    return {
      valid: true,
      data: { newPin: cleanPin }
    };
  }

  return {
    valid: true,
    data: { newPin: '' }
  };
}

export function validateUpdateUserDetailsSchema(body = {}) {
  const { fullName, phone } = body;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 60) {
    return { valid: false, error: 'שם מלא חייב להכיל בין 2 ל-60 תווים' };
  }

  if (!phone || typeof phone !== 'string' || phone.trim().length < 9 || phone.trim().length > 15) {
    return { valid: false, error: 'מספר טלפון אינו תקין' };
  }

  return {
    valid: true,
    data: {
      fullName: fullName.trim(),
      phone: phone.trim()
    }
  };
}

export function validateChangePasswordSchema(body = {}) {
  const { currentPin, newPin } = body;

  if (!newPin || typeof newPin !== 'string' || newPin.trim().length < 6) {
    return { valid: false, error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים' };
  }

  return {
    valid: true,
    data: {
      currentPin: currentPin ? String(currentPin).trim() : '',
      newPin: String(newPin).trim()
    }
  };
}

export function validateCreateProductSchema(body = {}) {
  const { name } = body;
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
    return { valid: false, error: 'שם המוצר חייב להכיל בין 2 ל-60 תווים' };
  }

  return {
    valid: true,
    data: { name: name.trim() }
  };
}

export function validateScheduleNextTreatmentSchema(body = {}) {
  const { busNumber, nextTreatmentDate } = body;

  if (!busNumber || typeof busNumber !== 'string' || busNumber.trim().length < 3 || busNumber.trim().length > 10) {
    return { valid: false, error: 'מספר אוטובוס אינו תקין' };
  }

  if (!nextTreatmentDate || typeof nextTreatmentDate !== 'string') {
    return { valid: false, error: 'נא להזין תאריך יעד תקין' };
  }

  const parsedDate = new Date(nextTreatmentDate);
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, error: 'מבנה תאריך אינו תקין' };
  }

  return {
    valid: true,
    data: {
      busNumber: busNumber.trim(),
      nextTreatmentDate: parsedDate.toISOString()
    }
  };
}

export function validateSubmitTreatmentSchema(body = {}) {
  const { busNumber, operator, summary, result, devices } = body;

  if (!busNumber || typeof busNumber !== 'string') {
    return { valid: false, error: 'מספר אוטובוס הוא שדה חובה' };
  }

  const cleanBusNumber = String(busNumber).replace(/[^0-9]/g, '').trim();
  const busError = validateBusNumber(cleanBusNumber);
  if (busError) {
    return { valid: false, error: busError };
  }

  const validOperators = ['דן בדרום', 'דן באר שבע'];
  if (!operator || !validOperators.includes(operator)) {
    return { valid: false, error: 'מפעיל חייב להיות דן בדרום או דן באר שבע' };
  }

  if (!summary || typeof summary !== 'string' || !summary.trim()) {
    return { valid: false, error: 'סיכום הטיפול והערות הטכנאי הוא שדה חובה' };
  }

  if (summary.trim().length > 1000) {
    return { valid: false, error: 'סיכום הטיפול ארוך מדי (מקסימום 1000 תווים)' };
  }

  const validResults = ['הכול תקין באוטובוס', 'נדרש המשך טיפול של הלקוח'];
  if (!result || !validResults.includes(result)) {
    return { valid: false, error: 'תוצאת טיפול אינה תקינה' };
  }

  let parsedDevices = devices;
  if (typeof parsedDevices === 'string') {
    try {
      parsedDevices = JSON.parse(parsedDevices);
    } catch {
      return { valid: false, error: 'מבנה נתוני מכשירים אינו תקין' };
    }
  }

  const minDevices = operator === 'דן בדרום' ? 1 : 3;
  if (!Array.isArray(parsedDevices) || parsedDevices.length < minDevices) {
    return { 
      valid: false, 
      error: `חובה לבדוק לפחות ${minDevices} ${minDevices === 1 ? 'מכשיר' : 'מכשירים'} עבור ${operator}` 
    };
  }

  if (parsedDevices.length > 12) {
    return { valid: false, error: 'ניתן לבדוק עד 12 מכשירים לכל היותר' };
  }

  const cleanedDevices = [];
  for (let i = 0; i < parsedDevices.length; i++) {
    const d = parsedDevices[i];
    if (!d || typeof d !== 'object') {
      return { valid: false, error: `פרטי מכשיר #${i + 1} אינם תקינים` };
    }

    const prodName = d.productName || d.product_name;
    const prodId = d.productId || d.product_id || null;

    if (!prodName && !prodId) {
      return { valid: false, error: `מכשיר #${i + 1}: חובה לבחור סוג מוצר` };
    }

    const serial = d.serialNumber || d.serial_number;
    const serialError = validateDeviceSerialNumber(serial);
    if (serialError) {
      return { valid: false, error: `מכשיר #${i + 1}: ${serialError}` };
    }

    if (!d.status || (d.status !== 'תקין' && d.status !== 'לא תקין')) {
      return { valid: false, error: `מכשיר #${i + 1}: חובה לבחור מצב (תקין / לא תקין)` };
    }

    cleanedDevices.push({
      productId: prodId ? Number(prodId) : null,
      productName: String(prodName || '').trim(),
      serialNumber: String(serial || '').trim(),
      status: d.status,
      notes: d.notes ? String(d.notes).trim() : ''
    });
  }

  return {
    valid: true,
    data: {
      busNumber: cleanBusNumber,
      operator,
      summary: summary.trim(),
      result,
      devices: cleanedDevices
    }
  };
}

export function validateEdiStatusSchema(body = {}) {
  const { isEdiClosed } = body;

  if (
    typeof isEdiClosed !== 'boolean' &&
    isEdiClosed !== 0 &&
    isEdiClosed !== 1
  ) {
    return {
      valid: false,
      error: 'ערך סטטוס אדי אינו תקין'
    };
  }

  return {
    valid: true,
    data: {
      isEdiClosed: Boolean(isEdiClosed)
    }
  };
}

export function validateResolutionNotesSchema(body = {}) {
  const { resolutionNotes } = body;

  if (
    resolutionNotes !== undefined &&
    resolutionNotes !== null &&
    typeof resolutionNotes !== 'string'
  ) {
    return {
      valid: false,
      error: 'הערות סגירה אינן תקינות'
    };
  }

  const clean = String(resolutionNotes || '').trim();

  if (clean.length > 500) {
    return {
      valid: false,
      error: 'הערות סגירה ארוכות מדי'
    };
  }

  return {
    valid: true,
    data: {
      resolutionNotes: clean
    }
  };
}
