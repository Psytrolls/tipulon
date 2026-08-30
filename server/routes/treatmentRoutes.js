import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { db, logAudit } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { evaluateBusStatus } from './busRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'bus-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 4 * 1024 * 1024 // 4MB limit according to spec
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('רק קובצי תמונה מורשים להעלאה'));
    }
  }
});

const router = express.Router();

// Middleware to handle multer file size error nicely
const handleUpload = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'גודל הקובץ עולה על 4MB, נא לבחור תמונה קטנה יותר' });
      }
      return res.status(400).json({ error: `שגיאה בהעלאת קובץ: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// POST /api/treatments - Submit a new treatment report
router.post('/', requireAuth, handleUpload, (req, res) => {
  try {
    const { busNumber, summary, result } = req.body;
    const operator = req.body.operator === 'דן בדרום' ? 'דן בדרום' : 'דן באר שבע';
    let devices = req.body.devices;

    if (typeof devices === 'string') {
      try {
        devices = JSON.parse(devices);
      } catch (e) {
        return res.status(400).json({ error: 'מבנה נתוני מכשירים אינו תקין' });
      }
    }

    if (!busNumber || !String(busNumber).trim()) {
      return res.status(400).json({ error: 'מספר אוטובוס הוא שדה חובה' });
    }

    const cleanBusNumber = String(busNumber).trim();

    // Check business rule: does this bus have an active future treatment?
    const busCheckStmt = db.prepare('SELECT bus_number, status, next_treatment_date FROM buses WHERE bus_number = ?');
    const existingBus = busCheckStmt.get(cleanBusNumber);

    if (existingBus) {
      const evaluation = evaluateBusStatus(existingBus);
      if (!evaluation.canStartTreatment) {
        return res.status(400).json({ error: evaluation.blockReason || 'אין צורך בביצוע טיפול מונע לאוטובוס זה' });
      }
    }

    // Devices count validation based on operator
    // דן בדרום: מינימום 1 מכשיר
    // דן באר שבע: מינימום 3 מכשירים
    const minDevices = operator === 'דן בדרום' ? 1 : 3;
    if (!Array.isArray(devices) || devices.length < minDevices) {
      return res.status(400).json({ 
        error: `חובה לבדוק לפחות ${minDevices} ${minDevices === 1 ? 'מכשיר' : 'מכשירים'} עבור ${operator}` 
      });
    }
    if (devices.length > 12) {
      return res.status(400).json({ error: 'ניתן לבדוק עד 12 מכשירים לכל היותר' });
    }

    // Validate each device
    for (let i = 0; i < devices.length; i++) {
      const dev = devices[i];
      if (!dev.productName && !dev.productId) {
        return res.status(400).json({ error: `מכשיר #${i + 1}: חובה לבחור סוג מוצר` });
      }
      if (!dev.serialNumber || !String(dev.serialNumber).trim()) {
        return res.status(400).json({ error: `מכשיר #${i + 1}: חובה להזין מספר סידורי או מזהה מכשיר` });
      }
      if (!dev.status || (dev.status !== 'תקין' && dev.status !== 'לא תקין')) {
        return res.status(400).json({ error: `מכשיר #${i + 1}: חובה לבחור מצב (תקין / לא תקין)` });
      }
    }

    // Summary validation (mandatory)
    if (!summary || !String(summary).trim()) {
      return res.status(400).json({ error: 'סיכום הטיפול והערות הטכנאי הוא שדה חובה' });
    }

    // Result validation
    const validResults = ['הכול תקין באוטובוס', 'נדרש המשך טיפול של הלקוח'];
    if (!result || !validResults.includes(result)) {
      return res.status(400).json({ error: 'תוצאת טיפול אינה תקינה' });
    }

    const reportStatus = result === 'נדרש המשך טיפול של הלקוח' ? 'הועבר להמשך טיפול' : 'הטיפול הושלם';
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
    const now = new Date().toISOString();

    // Begin saving report
    const insertReportStmt = db.prepare(`
      INSERT INTO reports (bus_number, operator, technician_id, technician_name, photo_path, summary, result, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const reportResult = insertReportStmt.run(
      cleanBusNumber,
      operator,
      req.user.id,
      req.user.fullName,
      photoPath,
      String(summary).trim(),
      result,
      reportStatus,
      now
    );

    const reportId = Number(reportResult.lastInsertRowid);

    // Insert devices
    const insertDeviceStmt = db.prepare(`
      INSERT INTO report_devices (report_id, product_id, product_name, serial_number, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const dev of devices) {
      insertDeviceStmt.run(
        reportId,
        dev.productId ? Number(dev.productId) : null,
        String(dev.productName || '').trim(),
        String(dev.serialNumber).trim(),
        dev.status,
        dev.notes ? String(dev.notes).trim() : null
      );
    }

    // Update bus state
    if (existingBus) {
      const updateBusStmt = db.prepare(`
        UPDATE buses 
        SET status = ?, operator = ?, last_treatment_date = ?, updated_at = datetime('now')
        WHERE bus_number = ?
      `);
      updateBusStmt.run(reportStatus, operator, now, cleanBusNumber);
    } else {
      const insertBusStmt = db.prepare(`
        INSERT INTO buses (bus_number, operator, status, last_treatment_date, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);
      insertBusStmt.run(cleanBusNumber, operator, reportStatus, now);
    }

    // Audit log
    logAudit(
      req.user.id,
      req.user.fullName,
      'סיום טיפול',
      'דוח טיפול',
      reportId,
      `דוח נשמר לאוטובוס ${cleanBusNumber} (${operator}), תוצאה: ${result}`
    );

    res.status(201).json({
      success: true,
      reportId,
      busNumber: cleanBusNumber,
      operator,
      status: reportStatus,
      createdAt: now
    });
  } catch (err) {
    console.error('Submit treatment error:', err);
    res.status(500).json({ error: 'שגיאה בשמירת דוח הטיפול' });
  }
});

// GET /api/treatments - List reports with filters
router.get('/', requireAuth, (req, res) => {
  try {
    const { busNumber, result, status, operator } = req.query;

    let query = `
      SELECT r.id, r.bus_number, r.operator, r.technician_id, r.technician_name, r.photo_path,
             r.summary, r.result, r.status, r.created_at, b.next_treatment_date
      FROM reports r
      LEFT JOIN buses b ON r.bus_number = b.bus_number
      WHERE 1=1
    `;
    const params = [];

    if (busNumber) {
      query += ' AND r.bus_number LIKE ?';
      params.push(`%${busNumber.trim()}%`);
    }
    if (operator) {
      query += ' AND r.operator = ?';
      params.push(operator);
    }
    if (result) {
      query += ' AND r.result = ?';
      params.push(result);
    }
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC LIMIT 150';

    const stmt = db.prepare(query);
    const reports = stmt.all(...params);

    res.json(reports);
  } catch (err) {
    console.error('Fetch treatments error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת היסטוריית טיפולים' });
  }
});

// GET /api/treatments/:id - Full report details
router.get('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const reportStmt = db.prepare(`
      SELECT r.*, b.next_treatment_date
      FROM reports r
      LEFT JOIN buses b ON r.bus_number = b.bus_number
      WHERE r.id = ?
    `);
    const report = reportStmt.get(id);

    if (!report) {
      return res.status(404).json({ error: 'דוח טיפול לא נמצא' });
    }

    const devicesStmt = db.prepare(`
      SELECT id, product_id, product_name, serial_number, status, notes
      FROM report_devices
      WHERE report_id = ?
      ORDER BY id ASC
    `);
    const devices = devicesStmt.all(id);

    res.json({
      ...report,
      devices
    });
  } catch (err) {
    console.error('Fetch report details error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת פרטי דוח' });
  }
});

// GET /api/treatments/export/excel - Professional Styled RTL Excel (.xlsx) export with AutoFilter
router.get('/export/excel', requireAdmin, async (req, res) => {
  try {
    const { operator } = req.query;

    let query = `
      SELECT r.id, r.operator, r.bus_number, r.created_at, r.technician_name, r.summary, r.result, r.status,
             b.next_treatment_date
      FROM reports r
      LEFT JOIN buses b ON r.bus_number = b.bus_number
      WHERE 1=1
    `;
    const params = [];
    if (operator && operator.trim()) {
      query += ' AND r.operator = ?';
      params.push(operator.trim());
    }
    query += ' ORDER BY r.created_at DESC';

    const stmt = db.prepare(query);
    const reports = stmt.all(...params);

    const devStmt = db.prepare(`
      SELECT report_id, product_name, serial_number, status, notes
      FROM report_devices
      ORDER BY id ASC
    `);
    const allDevices = devStmt.all();

    const devicesByReport = {};
    for (const d of allDevices) {
      if (!devicesByReport[d.report_id]) {
        devicesByReport[d.report_id] = [];
      }
      devicesByReport[d.report_id].push(`${d.product_name} (${d.serial_number}) - ${d.status}${d.notes ? ' [' + d.notes + ']' : ''}`);
    }

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'טיפולון';
    workbook.created = new Date();

    const sheetName = operator ? `דוחות ${operator}` : 'דוחות טיפול מונע';

    // Create Worksheet with RIGHT-TO-LEFT view for Hebrew
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: true }] // RTL IN EXCEL!
    });

    // Define Columns
    worksheet.columns = [
      { header: 'מזהה דוח', key: 'id', width: 12 },
      { header: 'מפעיל / חברה', key: 'operator', width: 16 },
      { header: 'מספר אוטובוס', key: 'bus_number', width: 16 },
      { header: 'תאריך ושעה', key: 'created_at', width: 20 },
      { header: 'שם הטכנאי', key: 'technician_name', width: 18 },
      { header: 'רשימת המכשירים ומצבם', key: 'devices', width: 42 },
      { header: 'סיכום הטכנאי', key: 'summary', width: 38 },
      { header: 'תוצאת הטיפול', key: 'result', width: 25 },
      { header: 'סטטוס', key: 'status', width: 18 },
      { header: 'תאריך טיפול הבא', key: 'next_date', width: 16 }
    ];

    // Style Header Row (Row 1)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF15803D' } // Elegant emerald green
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0D5328' } },
        left: { style: 'thin', color: { argb: 'FF0D5328' } },
        bottom: { style: 'medium', color: { argb: 'FF0D5328' } },
        right: { style: 'thin', color: { argb: 'FF0D5328' } }
      };
    });

    // Add Data Rows
    reports.forEach((r, index) => {
      const devListStr = (devicesByReport[r.id] || []).join('\n');
      const formattedDate = new Date(r.created_at).toLocaleString('he-IL');
      const nextDateFormatted = r.next_treatment_date ? new Date(r.next_treatment_date).toLocaleDateString('he-IL') : 'לא נקבע';

      const row = worksheet.addRow({
        id: `#${r.id}`,
        operator: r.operator || 'דן באר שבע',
        bus_number: r.bus_number,
        created_at: formattedDate,
        technician_name: r.technician_name,
        devices: devListStr,
        summary: r.summary,
        result: r.result,
        status: r.status,
        next_date: nextDateFormatted
      });

      row.height = devListStr.includes('\n') ? 45 : 26;

      // Zebra striping: alternate background
      const isEven = index % 2 === 1;
      const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgArgb }
        };
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: colNumber === 3 || colNumber === 1 // Bus number & ID bold
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colNumber === 1 || colNumber === 4 || colNumber === 8 || colNumber === 9 || colNumber === 10) ? 'center' : 'right',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Color status / result text
        if (colNumber === 9) { // Status
          if (r.status === 'הטיפול הושלם') {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF15803D' } };
          } else {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFBE123C' } };
          }
        }
      });
    });

    // Enable Excel native AutoFilter on the table only if rows exist
    if (reports.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: reports.length + 1, column: 10 }
      };
    }

    const opNameAscii = operator === 'דן בדרום' ? 'dan_badarom' : operator === 'דן באר שבע' ? 'dan_beer_sheva' : 'all_operators';
    const filenameAscii = `tipulon_reports_${opNameAscii}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const operatorSuffix = operator ? `_${operator.replace(/\s+/g, '_')}` : '';
    const filenameUtf8 = `tipulon_reports${operatorSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Write to in-memory buffer to guarantee complete and uncorrupted file transmission
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameAscii}"; filename*=UTF-8''${encodeURIComponent(filenameUtf8)}`);
    res.setHeader('Content-Length', buffer.length);

    res.send(Buffer.from(buffer));

    logAudit(req.user.id, req.user.fullName, 'ייצוא לאקסל (XLSX RTL)', 'דוחות', null, `יוצאו ${reports.length} דוחות לאקסל מעוצב בעברית`);
  } catch (err) {
    console.error('Export Excel XLSX error:', err);
    res.status(500).json({ error: 'שגיאה בהפקת קובץ Excel' });
  }
});

// GET /api/treatments/export/csv - CSV export kept for backward compatibility
router.get('/export/csv', requireAdmin, (req, res) => {
  res.redirect('/api/treatments/export/excel');
});

export default router;
