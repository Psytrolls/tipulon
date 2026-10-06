/**
 * Centralized Schema Validation for Mutating API Routes
 */

export function validateBody(validatorFn) {
  return (req, res, next) => {
    try {
      const result = validatorFn(req.body);
      if (!result.valid) {
        return res.status(400).json({ error: result.error });
      }
      req.validatedBody = result.data;
      next();
    } catch (err) {
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
  const { bus_number, operator, technician_name, summary, status, devices } = body;

  if (!bus_number || typeof bus_number !== 'string' || bus_number.trim().length < 3 || bus_number.trim().length > 10) {
    return { valid: false, error: 'מספר אוטובוס אינו תקין' };
  }

  const validOperators = ['דן בדרום', 'דן באר שבע'];
  if (!operator || !validOperators.includes(operator)) {
    return { valid: false, error: 'מפעיל חייב להיות דן בדרום או דן באר שבע' };
  }

  if (!technician_name || typeof technician_name !== 'string' || technician_name.trim().length < 2) {
    return { valid: false, error: 'שם הטכנאי אינו תקין' };
  }

  const validStatuses = ['הטיפול הושלם', 'הועבר להמשך טיפול'];
  if (!status || !validStatuses.includes(status)) {
    return { valid: false, error: 'סטטוס טיפול אינו תקין' };
  }

  if (!Array.isArray(devices) || devices.length < 3 || devices.length > 12) {
    return { valid: false, error: 'דוח טיפול חייב להכיל בין 3 ל-12 מכשירים' };
  }

  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    if (!d || typeof d !== 'object') {
      return { valid: false, error: `פרטי מכשיר #${i + 1} אינם תקינים` };
    }
    if (!d.product_name || typeof d.product_name !== 'string') {
      return { valid: false, error: `שם מוצר במכשיר #${i + 1} חסר` };
    }
    if (!d.serial_number || typeof d.serial_number !== 'string' || d.serial_number.trim().length < 3 || d.serial_number.trim().length > 4) {
      return { valid: false, error: `מספר סידורי במכשיר #${i + 1} חייב להכיל 3 או 4 ספרות` };
    }
  }

  return {
    valid: true,
    data: {
      bus_number: bus_number.trim(),
      operator,
      technician_name: technician_name.trim(),
      summary: summary ? String(summary).trim() : '',
      status,
      devices
    }
  };
}

export function validateEdiStatusSchema(body = {}) {
  const { is_edi_closed } = body;
  if (typeof is_edi_closed !== 'boolean' && is_edi_closed !== 0 && is_edi_closed !== 1) {
    return { valid: false, error: 'ערך סטטוס אדי אינו תקין (חייב להיות boolean)' };
  }
  return {
    valid: true,
    data: { is_edi_closed: Boolean(is_edi_closed) }
  };
}

export function validateResolutionNotesSchema(body = {}) {
  const { resolution_notes } = body;
  if (resolution_notes && (typeof resolution_notes !== 'string' || resolution_notes.length > 500)) {
    return { valid: false, error: 'הערות סגירה ארוכות מדי (מקסימום 500 תווים)' };
  }
  return {
    valid: true,
    data: { resolution_notes: resolution_notes ? String(resolution_notes).trim() : '' }
  };
}
