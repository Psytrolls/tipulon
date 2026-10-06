import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');
const backupsDir = path.join(dataDir, 'backups');
const dbPath = path.join(dataDir, 'tipulon.db');

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

let lastBackupDate = null;

function isWeakOrTemplateSecret(secret) {
  if (!secret || typeof secret !== 'string') return true;
  const lower = secret.toLowerCase().trim();
  const blockedPrefixes = ['replace_with_', 'your_secret_', 'changeme', 'example_', 'default_'];
  return blockedPrefixes.some(prefix => lower.startsWith(prefix));
}

// Derive a deterministic 32-byte AES-256 key strictly from BACKUP_ENCRYPTION_KEY environment variable
function getBackupKey() {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;

  if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || isWeakOrTemplateSecret(secret)) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be configured, contain at least 32 bytes, and not use placeholder values');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

const BACKUP_MAGIC = Buffer.from('TPBK'); // Tipulon Backup Header (4 bytes)

/**
 * Encrypts a buffer using AES-256-GCM
 */
export function encryptBackupBuffer(plainBuffer) {
  const key = getBackupKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Format: [MAGIC (4B)][IV (12B)][AUTH_TAG (16B)][ENCRYPTED_DATA]
  return Buffer.concat([BACKUP_MAGIC, iv, authTag, encrypted]);
}

/**
 * Decrypts an encrypted backup buffer
 */
export function decryptBackupBuffer(encryptedBuffer) {
  const key = getBackupKey();
  if (encryptedBuffer.length < 32 || !encryptedBuffer.subarray(0, 4).equals(BACKUP_MAGIC)) {
    throw new Error('Invalid or unencrypted backup file format');
  }

  const iv = encryptedBuffer.subarray(4, 16);
  const authTag = encryptedBuffer.subarray(16, 32);
  const data = encryptedBuffer.subarray(32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Creates an AES-256-GCM encrypted and gzipped backup of the SQLite database
 */
export async function createBackup({ reason = 'scheduled', sendEmail = true } = {}) {
  try {
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file not found at ${dbPath}`);
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `tipulon_backup_${dateStr}_${timeStr}.db.enc.gz`;
    const targetPath = path.join(backupsDir, filename);

    // 1. Read raw DB
    const dbBuffer = fs.readFileSync(dbPath);

    // 2. Compress with GZIP
    const compressed = zlib.gzipSync(dbBuffer);

    // 3. Encrypt with AES-256-GCM
    const encryptedPayload = encryptBackupBuffer(compressed);

    // 4. Save to disk
    fs.writeFileSync(targetPath, encryptedPayload);

    lastBackupDate = dateStr;
    const sizeKb = (encryptedPayload.length / 1024).toFixed(1);

    console.log(`🛡️ [Backup] Created AES-256-GCM encrypted backup: ${filename} (${sizeKb} KB) [Reason: ${reason}]`);

    // Clean up old backups (keep last 30)
    pruneOldBackups(30);

    // Send encrypted email attachment if configured
    if (sendEmail && process.env.BACKUP_EMAIL && process.env.SMTP_HOST) {
      await sendBackupEmail(targetPath, filename, sizeKb, dateStr);
    }

    return {
      success: true,
      filename,
      filePath: targetPath,
      sizeBytes: encryptedPayload.length,
      sizeFormatted: `${sizeKb} KB`,
      isEncrypted: true,
      encryptionAlgorithm: 'AES-256-GCM',
      date: dateStr,
      timestamp: now.toISOString(),
      reason
    };
  } catch (err) {
    console.error('❌ [Backup] Failed to create encrypted database backup:', err);
    throw err;
  }
}

/**
 * Retain the most recent N backups and delete older files
 */
function pruneOldBackups(maxKeep = 30) {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.gz'))
      .map(f => {
        const fullPath = path.join(backupsDir, f);
        const stat = fs.statSync(fullPath);
        return { name: f, path: fullPath, mtime: stat.mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (files.length > maxKeep) {
      const toDelete = files.slice(maxKeep);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
        console.log(`🧹 [Backup] Pruned old backup: ${item.name}`);
      }
    }
  } catch (e) {
    console.warn('⚠️ [Backup] Error pruning old backups:', e.message);
  }
}

/**
 * List all available backups
 */
export function listBackups() {
  try {
    if (!fs.existsSync(backupsDir)) return [];
    return fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.gz'))
      .map(f => {
        const fullPath = path.join(backupsDir, f);
        const stat = fs.statSync(fullPath);
        const isEncrypted = f.includes('.enc.');
        return {
          filename: f,
          sizeBytes: stat.size,
          sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
          isEncrypted,
          encryptionAlgorithm: isEncrypted ? 'AES-256-GCM' : 'None',
          createdAt: stat.mtime.toISOString(),
          timestamp: stat.mtime.getTime()
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    return [];
  }
}

/**
 * Return absolute path of latest backup file
 */
export function getLatestBackupPath() {
  const backups = listBackups();
  if (backups.length === 0) return null;
  return path.join(backupsDir, backups[0].filename);
}

/**
 * Secure email delivery of ENCRYPTED backup only
 */
async function sendBackupEmail(filePath, filename, sizeKb, dateStr) {
  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"טיפולון - גיבוי מאובטח" <${process.env.SMTP_USER}>`,
      to: process.env.BACKUP_EMAIL,
      subject: `[טיפולון] גיבוי מסד נתונים מוצפן (AES-256-GCM) - ${dateStr}`,
      text: `שלום,\n\nמצורף קובץ גיבוי מוצפן (AES-256-GCM) ומאובטח של מערכת טיפולון מהתאריך ${dateStr}.\nגודל קובץ: ${sizeKb} KB\nשם קובץ: ${filename}\n\nהקובץ מוצפן ואינו ניתן לפענוח ללא מפתח ההצפנה של המערכת.\n\nבברכה,\nמערכת טיפולון`,
      attachments: [
        {
          filename,
          path: filePath
        }
      ]
    });

    console.log(`📧 [Backup] Encrypted backup email successfully sent to ${process.env.BACKUP_EMAIL}`);
  } catch (err) {
    console.warn('⚠️ [Backup] Could not send backup email (check SMTP settings):', err.message);
  }
}

/**
 * Start the daily backup scheduler
 */
export function startBackupScheduler() {
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!key || Buffer.byteLength(key, 'utf8') < 32 || isWeakOrTemplateSecret(key)) {
    console.warn('⚠️ [Backup] BACKUP_ENCRYPTION_KEY is not configured, shorter than 32 bytes, or using a placeholder value. Backup encryption is disabled until configured.');
    return;
  }

  console.log('⏰ [Backup] Backup service initialized with AES-256-GCM encryption.');

  // Run on startup if no backup exists for today
  setTimeout(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existingToday = listBackups().some(b => b.filename.includes(today));
      if (!existingToday) {
        console.log('🛡️ [Backup] No backup found for today, running initial startup backup...');
        await createBackup({ reason: 'startup' });
      } else {
        console.log('🛡️ [Backup] Today\'s backup already exists.');
      }
    } catch (e) {
      console.warn('Startup backup notice:', e.message);
    }
  }, 3000);

  // Hourly check: if 02:00 AM local time and not backed up today, run backup
  const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const today = now.toISOString().slice(0, 10);

      // Default backup hour is 02:00 AM (or BACKUP_HOUR env)
      const targetHour = Number(process.env.BACKUP_HOUR) || 2;

      if (currentHour === targetHour && lastBackupDate !== today) {
        console.log(`⏰ [Backup] Running nightly scheduled backup at ${currentHour}:00...`);
        await createBackup({ reason: 'nightly_cron' });
      }
    } catch (e) {
      console.error('Scheduled backup error:', e);
    }
  }, CHECK_INTERVAL);
}
