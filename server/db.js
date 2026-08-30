import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tipulon.db');
export const db = new DatabaseSync(dbPath);

// Crypto helpers for PBKDF2
export function hashPin(pin, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPin(pin, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
  return hash === expectedHash;
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
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
  `);

  // Safe migrations for existing DB
  try { db.exec("ALTER TABLE buses ADD COLUMN operator TEXT DEFAULT 'דן באר שבע'"); } catch (e) {}
  try { db.exec("ALTER TABLE reports ADD COLUMN operator TEXT DEFAULT 'דן באר שבע'"); } catch (e) {}

  seedInitialData();
}

function seedInitialData() {
  // Seed Products
  const initialProducts = [
    'מכשיר תיקוף',
    'מחשב נהג',
    'נתב תקשורת',
    'מודם סלולרי',
    'מצלמת דרך',
    'מסך נוסעים'
  ];

  const checkProduct = db.prepare('SELECT id FROM products WHERE name = ?');
  const insertProduct = db.prepare('INSERT INTO products (name, is_active) VALUES (?, 1)');

  for (const prod of initialProducts) {
    if (!checkProduct.get(prod)) {
      insertProduct.run(prod);
    }
  }

  // Seed Admin & Technician users
  const checkUser = db.prepare('SELECT id FROM users WHERE phone = ?');
  const insertUser = db.prepare('INSERT INTO users (full_name, phone, pin_hash, pin_salt, role, is_active) VALUES (?, ?, ?, ?, ?, 1)');

  // 1. Admin
  const adminPhone = normalizePhone('0501234567');
  if (!checkUser.get(adminPhone)) {
    const { hash, salt } = hashPin('1234');
    insertUser.run('מנהל מערכת', adminPhone, hash, salt, 'admin');
  }

  // 2. Technician
  const techPhone = normalizePhone('0521234567');
  if (!checkUser.get(techPhone)) {
    const { hash, salt } = hashPin('1234');
    insertUser.run('ישראל ישראלי', techPhone, hash, salt, 'technician');
  }

  // Seed sample buses
  const checkBus = db.prepare('SELECT bus_number FROM buses WHERE bus_number = ?');
  const insertBus = db.prepare('INSERT INTO buses (bus_number, status, last_treatment_date, next_treatment_date) VALUES (?, ?, ?, ?)');

  if (!checkBus.get('1234567')) {
    // Valid future treatment: 30 days ahead
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    insertBus.run('1234567', 'טיפול בתוקף', new Date().toISOString(), futureDate.toISOString());
  }

  if (!checkBus.get('9876543')) {
    // Treatment needed: no future date
    insertBus.run('9876543', 'נדרש טיפול', null, null);
  }

  if (!checkBus.get('5544332')) {
    // Overdue treatment: past date
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    insertBus.run('5544332', 'טיפול באיחור', null, pastDate.toISOString());
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
    console.error('Failed to log audit:', err);
  }
}
