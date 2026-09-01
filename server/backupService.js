import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
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

/**
 * Creates a compressed gzip backup of the SQLite database
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
    const filename = `tipulon_backup_${dateStr}_${timeStr}.db.gz`;
    const targetPath = path.join(backupsDir, filename);

    // Read and compress
    const dbBuffer = fs.readFileSync(dbPath);
    const compressed = zlib.gzipSync(dbBuffer);
    fs.writeFileSync(targetPath, compressed);

    lastBackupDate = dateStr;
    const sizeKb = (compressed.length / 1024).toFixed(1);

    console.log(`🛡️ [Backup] Created database backup: ${filename} (${sizeKb} KB) [Reason: ${reason}]`);

    // Clean up old backups (keep last 30)
    pruneOldBackups(30);

    // Send email if configured
    if (sendEmail && process.env.BACKUP_EMAIL && process.env.SMTP_HOST) {
      await sendBackupEmail(targetPath, filename, sizeKb, dateStr);
    }

    return {
      success: true,
      filename,
      filePath: targetPath,
      sizeBytes: compressed.length,
      sizeFormatted: `${sizeKb} KB`,
      date: dateStr,
      timestamp: now.toISOString(),
      reason
    };
  } catch (err) {
    console.error('❌ [Backup] Failed to create database backup:', err);
    throw err;
  }
}

/**
 * Retain the most recent N backups and delete older files
 */
function pruneOldBackups(maxKeep = 30) {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.db.gz'))
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
      .filter(f => f.endsWith('.db.gz'))
      .map(f => {
        const fullPath = path.join(backupsDir, f);
        const stat = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stat.size,
          sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
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
 * Optional email sender via Nodemailer
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
      from: process.env.SMTP_FROM || `"טיפולון - גיבוי" <${process.env.SMTP_USER}>`,
      to: process.env.BACKUP_EMAIL,
      subject: `[טיפולון] גיבוי מסד נתונים אוטומטי - ${dateStr}`,
      text: `שלום,\n\nמצורף קובץ גיבוי דחוס של מערכת טיפולון מהתאריך ${dateStr}.\nגודל קובץ: ${sizeKb} KB\nשם קובץ: ${filename}\n\nבברכה,\nמערכת טיפולון`,
      attachments: [
        {
          filename,
          path: filePath
        }
      ]
    });

    console.log(`📧 [Backup] Backup email successfully sent to ${process.env.BACKUP_EMAIL}`);
  } catch (err) {
    console.warn('⚠️ [Backup] Could not send backup email (check SMTP settings):', err.message);
  }
}

/**
 * Start the daily backup scheduler
 */
export function startBackupScheduler() {
  console.log('⏰ [Backup] Backup service initialized.');

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
