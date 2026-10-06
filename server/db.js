import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validatePasswordStrength } from './utils/passwordPolicy.js';
import { safeLog, safeError, safeWarn } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(path.join(dataDir, 'tipulon.db'));

// Crypto helpers for PBKDF2 (220,000 iterations, SHA-512)
const PBKDF2_ITERATIONS = 220000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
const LEGACY_ITERATIONS = 10000;

export function hashPin(pin, salt = null, iterations = PBKDF2_ITERATIONS) {
  if (!salt) {
    salt = crypto.randomBytes(32).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(String(pin), salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  const storedHash = `pbkdf2$${iterations}$${hash}`;
  return { hash: storedHash, salt };
}

export function verifyPin(pin, salt, storedHash) {
  if (!pin || !salt || !storedHash) return { valid: false, needsRehash: false };
  try {
    const cleanPin = String(pin);

    // Format: pbkdf2$<iterations>$<hashHex>
    if (storedHash.startsWith('pbkdf2$')) {
      const parts = storedHash.split('$');
      const iterations = parseInt(parts[1], 10) || PBKDF2_ITERATIONS;
      const hashHex = parts[2];
      const computed = crypto.pbkdf2Sync(cleanPin, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
      const expectedBuffer = Buffer.from(hashHex, 'hex');
      if (computed.length !== expectedBuffer.length) {
        return { valid: false, needsRehash: false };
      }
      const valid = crypto.timingSafeEqual(computed, expectedBuffer);
      return { valid, needsRehash: iterations < PBKDF2_ITERATIONS };
    }

    // Legacy fallback (10,000 iterations without prefix)
    const legacyComputed = crypto.pbkdf2Sync(cleanPin, salt, LEGACY_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    const legacyExpected = Buffer.from(storedHash, 'hex');
    if (legacyComputed.length !== legacyExpected.length) {
      return { valid: false, needsRehash: false };
    }
    const valid = crypto.timingSafeEqual(legacyComputed, legacyExpected);
    return { valid, needsRehash: valid };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

export function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

// Initialize tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('technician', 'admin')),
      is_active INTEGER DEFAULT 1,
      is_super_admin INTEGER DEFAULT 0,
      must_change_pin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS buses (
      bus_number TEXT PRIMARY KEY,
      operator TEXT DEFAULT 'דן באר שבע',
      status TEXT NOT NULL DEFAULT 'נדרש טיפול',
      last_treatment_date DATETIME,
      next_treatment_date DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bus_number TEXT NOT NULL,
      operator TEXT DEFAULT 'דן באר שבע',
      technician_id INTEGER NOT NULL,
      technician_name TEXT NOT NULL,
      photo_path TEXT,
      summary TEXT NOT NULL,
      result TEXT NOT NULL,
      status TEXT NOT NULL,
      is_edi_closed INTEGER DEFAULT 0,
      edi_closed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (technician_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS report_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('תקין', 'לא תקין')),
      notes TEXT,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      phone TEXT,
      attempted_at INTEGER NOT NULL,
      is_success INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS security_lockouts (
      target_type TEXT NOT NULL,
      target_value TEXT NOT NULL,
      locked_until INTEGER NOT NULL,
      reason TEXT,
      PRIMARY KEY (target_type, target_value)
    );
  `);

  // Safe migrations and cleanups for existing DB
  try { db.exec("ALTER TABLE buses ADD COLUMN operator TEXT DEFAULT 'דן באר שבע'"); } catch (e) {}
  try { db.exec("ALTER TABLE buses ADD COLUMN short_number TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE buses ADD COLUMN cluster TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE buses ADD COLUMN bus_type TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE buses ADD COLUMN production_year INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE buses ADD COLUMN last_known_location TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE buses ADD COLUMN work_plan TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE buses ADD COLUMN work_status TEXT"); } catch (e) {}

  try { db.exec("ALTER TABLE reports ADD COLUMN operator TEXT DEFAULT 'דן באר שבע'"); } catch (e) {}
  try { db.exec("ALTER TABLE reports ADD COLUMN is_edi_closed INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE reports ADD COLUMN edi_closed_at DATETIME"); } catch (e) {}
  try { db.exec("ALTER TABLE reports ADD COLUMN location TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE reports ADD COLUMN resolution_notes TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE reports ADD COLUMN resolved_at DATETIME"); } catch (e) {}
  try { db.exec("ALTER TABLE reports ADD COLUMN resolved_by TEXT"); } catch (e) {}

  // Explicit mapping for sample short number from Dan spec
  try { db.exec("UPDATE buses SET short_number = '1687' WHERE bus_number = '14945702'"); } catch (e) {}

  // Cleanup old test/mock buses from initial setup
  try { db.exec("DELETE FROM buses WHERE bus_number IN ('1234567', '9876543', '5544332')"); } catch (e) {}

  // Cleanup old demo/test users (0501234567, 0521234567) so they don't reappear on deploy
  try { db.exec("DELETE FROM users WHERE phone IN ('0501234567', '0521234567')"); } catch (e) {}

  // Migration: Add must_change_pin and is_super_admin columns to users table if missing
  try {
    db.exec(`ALTER TABLE users ADD COLUMN must_change_pin INTEGER DEFAULT 0`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0`);
  } catch (e) {}

  // Session Security Migration (v3): Rename token to token_hash, purge old sessions, set user_version = 3
  try {
    const userVersion = db.prepare('PRAGMA user_version').get()?.user_version || 0;
    if (userVersion < 3) {
      db.exec('BEGIN TRANSACTION');
      try {
        const columns = db.prepare('PRAGMA table_info(sessions)').all();
        const hasToken = columns.some(c => c.name === 'token');
        const hasTokenHash = columns.some(c => c.name === 'token_hash');

        if (hasToken && !hasTokenHash) {
          db.exec('ALTER TABLE sessions RENAME COLUMN token TO token_hash');
        }

        const updatedColumns = db.prepare('PRAGMA table_info(sessions)').all();
        if (!updatedColumns.some(c => c.name === 'token_hash')) {
          throw new Error('Session migration failed: token_hash column is missing');
        }

        db.exec('DELETE FROM sessions');
        db.exec('PRAGMA user_version = 3');
        db.exec('COMMIT');
        safeLog('🛡️ [Migration] Successfully executed session migration to token_hash (user_version = 3)');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }
  } catch (e) {
    safeError('❌ [Migration Error] Failed to execute database migration:', e);
    throw e;
  }

  // Periodic expiration purge
  try {
    db.exec(`DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')`);
  } catch (e) {}
  try {
    db.exec(`
      UPDATE reports
      SET status = 'הטיפול הושלם', result = 'תקין'
      WHERE status = 'הועבר להמשך טיפול'
        AND bus_number IN (SELECT bus_number FROM buses WHERE status IN ('הטיפול הושלם', 'טיפול בתוקף'))
    `);
  } catch (e) {}

  // Ensure every bus with completed treatment has next_treatment_date calculated (+6 months)
  try {
    db.exec(`
      UPDATE buses
      SET next_treatment_date = (
        SELECT datetime(r.created_at, '+6 months')
        FROM reports r
        WHERE r.bus_number = buses.bus_number AND r.status = 'הטיפול הושלם'
        ORDER BY r.created_at DESC
        LIMIT 1
      ),
      last_treatment_date = COALESCE(last_treatment_date, (
        SELECT r.created_at
        FROM reports r
        WHERE r.bus_number = buses.bus_number AND r.status = 'הטיפול הושלם'
        ORDER BY r.created_at DESC
        LIMIT 1
      ))
      WHERE (next_treatment_date IS NULL OR next_treatment_date = '')
        AND EXISTS (SELECT 1 FROM reports r WHERE r.bus_number = buses.bus_number AND r.status = 'הטיפול הושלם')
    `);
  } catch (e) {}

  // Backfill resolution_notes from audit_logs for previously closed follow-ups
  try {
    const closedLogs = db.prepare(`
      SELECT entity_id as bus_number, details, user_name, created_at
      FROM audit_logs
      WHERE action = 'סגירת המשך טיפול'
    `).all();

    const updateReportRes = db.prepare(`
      UPDATE reports
      SET resolution_notes = ?,
          resolved_at = COALESCE(resolved_at, ?),
          resolved_by = COALESCE(resolved_by, ?)
      WHERE bus_number = ? AND (resolution_notes IS NULL OR resolution_notes = '')
    `);

    for (const log of closedLogs) {
      let notes = log.details || '';
      if (notes.includes('המשך טיפול נסגר על ידי מנהל: ')) {
        notes = notes.replace('המשך טיפול נסגר על ידי מנהל: ', '').trim();
      } else if (notes.includes('המשך טיפול נסגר על ידי מנהל')) {
        notes = notes.replace('המשך טיפול נסגר על ידי מנהל', '').trim();
      }
      if (notes.startsWith(':')) notes = notes.substring(1).trim();
      if (!notes) notes = 'המשך טיפול נסגר ע״י מנהל';

      updateReportRes.run(notes, log.created_at, log.user_name || 'מנהל מערכת', log.bus_number);
    }
  } catch (e) {}

  // Migration: Add must_change_pin and is_super_admin columns to users table if missing
  try {
    db.exec(`ALTER TABLE users ADD COLUMN must_change_pin INTEGER DEFAULT 0`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0`);
  } catch (e) {}

  seedInitialData();
}

// Auto-run schema initialization on load
initDatabase();

function seedInitialData() {
  // Seed Products (The 3 official bus ticketing / validation devices)
  const initialProducts = [
    'PCE 415',
    'VPE 420',
    'VPE 430'
  ];

  const checkProduct = db.prepare('SELECT id FROM products WHERE name = ?');
  const insertProduct = db.prepare('INSERT INTO products (name, is_active) VALUES (?, 1)');
  const activateProduct = db.prepare('UPDATE products SET is_active = 1 WHERE name = ?');

  for (const prodName of initialProducts) {
    const existing = checkProduct.get(prodName);
    if (!existing) {
      insertProduct.run(prodName);
    } else {
      activateProduct.run(prodName);
    }
  }

  // Deactivate old generic products if they exist and aren't used in past reports
  try {
    db.exec(`
      UPDATE products 
      SET is_active = 0 
      WHERE name IN ('מכשיר תיקוף', 'מחשב נהג', 'נתב תקשורת', 'מודם סלולרי', 'מצלמת דרך', 'מסך נוסעים')
        AND id NOT IN (SELECT product_id FROM report_devices WHERE product_id IS NOT NULL);
    `);
  } catch (e) {}

  // Optional: Create initial super-admin ONLY if configured via environment variables and no admin exists
  const envAdminPhone = process.env.INIT_ADMIN_PHONE ? normalizePhone(process.env.INIT_ADMIN_PHONE) : null;
  const envAdminPin = process.env.INIT_ADMIN_PIN || null;
  const envAdminName = process.env.INIT_ADMIN_NAME || 'מנהל מערכת';

  if (envAdminPhone && envAdminPin) {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    if (adminCount === 0) {
      const policy = validatePasswordStrength(envAdminPin, {
        phone: envAdminPhone,
        fullName: envAdminName,
        role: 'admin'
      });

      if (!policy.valid) {
        safeError(`❌ [SECURITY] Cannot bootstrap initial admin: ${policy.error}. Please provide a strong password for INIT_ADMIN_PIN.`);
        return;
      }

      const { hash, salt } = hashPin(envAdminPin);
      db.prepare(`
        INSERT INTO users (full_name, phone, pin_hash, pin_salt, role, is_active, is_super_admin, must_change_pin)
        VALUES (?, ?, ?, ?, 'admin', 1, 1, 1)
      `).run(envAdminName, envAdminPhone, hash, salt);
      safeLog(`[SECURITY] Initial Super Admin account created for ${envAdminPhone}`);
    }
  }
}

export function logAudit(userId, userName, action, entity, entityId = null, details = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId, userName, action, entity, String(entityId || ''), details ? String(details) : '');
  } catch (err) {
    safeError('Failed to log audit:', err);
  }
}
