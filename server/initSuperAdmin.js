import { db, normalizePhone, hashPin, logAudit } from './db.js';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const phoneArg = args[0] || process.env.INIT_ADMIN_PHONE;
const pinArg = args[1] || process.env.INIT_ADMIN_PIN;
const nameArg = args[2] || process.env.INIT_ADMIN_NAME || 'מנהל ראשי';

if (!phoneArg) {
  console.log(`
Usage:
  node server/initSuperAdmin.js <phone> [pin] [fullName]

Example:
  node server/initSuperAdmin.js 0546434001 SecurePass2026 "יבגני קבישר"
`);
  process.exit(1);
}

const cleanPhone = normalizePhone(phoneArg);
if (cleanPhone.length < 9) {
  console.error('Error: Phone number is invalid.');
  process.exit(1);
}

const finalPin = pinArg || crypto.randomBytes(5).toString('hex') + 'A1';
const { hash, salt } = hashPin(finalPin);

const checkStmt = db.prepare('SELECT id, full_name, phone FROM users WHERE phone = ?');
const existing = checkStmt.get(cleanPhone);

if (existing) {
  db.prepare(`
    UPDATE users 
    SET pin_hash = ?, pin_salt = ?, role = 'admin', is_super_admin = 1, is_active = 1, must_change_pin = 1, full_name = ?
    WHERE id = ?
  `).run(hash, salt, nameArg, existing.id);

  // Invalidate all active sessions for security
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);

  console.log(`\n✅ Super Admin updated successfully for phone: ${cleanPhone}`);
  console.log(`🔑 Temporary Password: ${finalPin}`);
  console.log(`⚠️ User must change password on next login (must_change_pin = 1).\n`);
} else {
  const insertStmt = db.prepare(`
    INSERT INTO users (full_name, phone, pin_hash, pin_salt, role, is_active, is_super_admin, must_change_pin)
    VALUES (?, ?, ?, ?, 'admin', 1, 1, 1)
  `);
  const result = insertStmt.run(nameArg, cleanPhone, hash, salt);

  console.log(`\n✅ Super Admin created successfully!`);
  console.log(`👤 Name: ${nameArg}`);
  console.log(`📱 Phone: ${cleanPhone}`);
  console.log(`🔑 Temporary Password: ${finalPin}`);
  console.log(`⚠️ User must change password on next login (must_change_pin = 1).\n`);
}

process.exit(0);
