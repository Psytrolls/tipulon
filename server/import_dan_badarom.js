/**
 * Script to import completed Dan BaDarom buses with EDI closed status
 */
import { db, initDatabase } from './db.js';

// Ensure tables and migrations exist
initDatabase();

const busList = [
  '17780403', '17077504', '17797903', '17800403', '4353234', '53151403',
  '17806103', '17089904', '15283102', '9676737', '9283001', '68530103',
  '68513203', '68512603', '59183101', '56257701', '53133403', '53118703',
  '53113003', '50871804', '50871604', '50871504', '50871004', '50869704',
  '38591602', '38591202', '38591002', '17801003', '17800703', '17786603',
  '17785403', '17779503', '17761103', '17761003', '17760303', '17758903',
  '17091204', '17087804', '17078104', '17078004', '17077804', '17077704',
  '17077604', '15280602', '14951002', '14946602', '14937402', '14936102',
  '14935702', '14932602', '14919702', '14917902', '14916902', '14914102',
  '14906002', '14905902', '14905402', '13793102', '9288201', '9287701',
  '9286201', '9286101', '9285901', '9283201', '9282901', '9282101',
  '9260201', '9260101', '7321952', '7295152', '7291252', '7290852',
  '7274552', '7270152', '7256952', '4356034', '4355934', '4354834',
  '4354534', '50885704', '4353334', '4352734', '4350834', '4350334',
  '4346934', '4346534', '3161939', '3161739', '2658439', '4343834',
  '1165039', '9283301'
];

// Unique set of bus numbers
const uniqueBuses = [...new Set(busList)];

console.log(`Starting import of ${uniqueBuses.length} Dan BaDarom buses...`);

// Find admin or first user to attribute reports to
const defaultUser = db.prepare('SELECT id, full_name FROM users ORDER BY id ASC LIMIT 1').get() || {
  id: 1,
  full_name: 'מנהל מערכת'
};

const treatmentDate = '2026-09-01';
// Next treatment in exactly 6 months
const nextDate = '2027-03-01';

const checkBusStmt = db.prepare('SELECT bus_number FROM buses WHERE bus_number = ?');
const updateBusStmt = db.prepare(`
  UPDATE buses 
  SET operator = 'דן בדרום', status = 'הטיפול הושלם', last_treatment_date = ?, next_treatment_date = ?, updated_at = datetime('now')
  WHERE bus_number = ?
`);
const insertBusStmt = db.prepare(`
  INSERT INTO buses (bus_number, operator, status, last_treatment_date, next_treatment_date, updated_at)
  VALUES (?, 'דן בדרום', 'הטיפול הושלם', ?, ?, datetime('now'))
`);

const insertReportStmt = db.prepare(`
  INSERT INTO reports (bus_number, operator, technician_id, technician_name, photo_path, summary, result, status, is_edi_closed, edi_closed_at, created_at)
  VALUES (?, 'דן בדרום', ?, ?, NULL, 'טיפול מונע תקופתי הושלם ונסגר באדי', 'הכול תקין באוטובוס', 'הטיפול הושלם', 1, ?, ?)
`);

const insertDeviceStmt = db.prepare(`
  INSERT INTO report_devices (report_id, product_name, serial_number, status, notes)
  VALUES (?, 'PCE 415', '415', 'תקין', 'נבדק ותקין')
`);

let insertedBuses = 0;
let insertedReports = 0;

db.exec('BEGIN TRANSACTION;');

try {
  for (const busNum of uniqueBuses) {
    const existing = checkBusStmt.get(busNum);
    if (existing) {
      updateBusStmt.run(treatmentDate, nextDate, busNum);
    } else {
      insertBusStmt.run(busNum, treatmentDate, nextDate);
      insertedBuses++;
    }

    // Insert completed report with EDI closed
    const reportRes = insertReportStmt.run(
      busNum,
      defaultUser.id,
      defaultUser.full_name,
      treatmentDate,
      treatmentDate
    );
    const reportId = Number(reportRes.lastInsertRowid);
    insertDeviceStmt.run(reportId);
    insertedReports++;
  }

  db.exec('COMMIT;');
  console.log(`✅ Success! ${uniqueBuses.length} Dan BaDarom buses imported and updated.`);
  console.log(`- Total buses updated/inserted: ${uniqueBuses.length}`);
  console.log(`- Total reports created: ${insertedReports}`);
  console.log(`- All marked as: סגור באדי (Closed in EDI)`);
  console.log(`- Treatment Date: ${treatmentDate}, Next Date: ${nextDate} (6 months validity)`);
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('Import failed, transaction rolled back:', err);
}
