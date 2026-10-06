import assert from 'node:assert';
import { validatePasswordStrength } from '../server/utils/passwordPolicy.js';

console.log('Running Password Policy Unit Tests...');

// 1. StrongPass123 for admin must pass
const res1 = validatePasswordStrength('StrongPass123', { role: 'admin' });
assert.strictEqual(res1.valid, true, 'StrongPass123 for admin should be valid');

// 2. StrongPass123 for technician must pass
const resTech = validatePasswordStrength('TechPass1', { role: 'technician' });
assert.strictEqual(resTech.valid, true, 'TechPass1 for technician should be valid');

// 3. Password without digit is rejected
const resNoDigit = validatePasswordStrength('StrongPassword', { role: 'admin' });
assert.strictEqual(resNoDigit.valid, false, 'Password without digit should be invalid');
assert.ok(resNoDigit.error.includes('מספרים'), 'Error should mention numbers');

// 4. Password without letter is rejected
const resNoLetter = validatePasswordStrength('123456789012', { role: 'admin' });
assert.strictEqual(resNoLetter.valid, false, 'Password without letter should be invalid');
assert.ok(resNoLetter.error.includes('אותיות'), 'Error should mention letters');

// 5. Short password for admin is rejected (<12 chars)
const resShortAdmin = validatePasswordStrength('Pass123', { role: 'admin' });
assert.strictEqual(resShortAdmin.valid, false, 'Short password for admin should be invalid');
assert.ok(resShortAdmin.error.includes('12'), 'Error should mention 12 characters');

// 6. Common weak password is rejected
const resWeak = validatePasswordStrength('admin123', { role: 'technician' });
assert.strictEqual(resWeak.valid, false, 'Common weak password should be invalid');

// 7. Password containing phone number is rejected
const resPhone = validatePasswordStrength('Secret0501234567', { role: 'admin', phone: '0501234567' });
assert.strictEqual(resPhone.valid, false, 'Password with phone number should be invalid');

// 8. Password with all repeated characters is rejected
const resRepeat = validatePasswordStrength('aaaaaaaaaaaa', { role: 'admin' });
assert.strictEqual(resRepeat.valid, false, 'All repeated characters should be invalid');

// 9. Function does not throw ReferenceError or any other exception on unexpected inputs
const inputs = [null, undefined, '', 12345, {}, [], 'a'.repeat(100)];
for (const input of inputs) {
  assert.doesNotThrow(() => {
    const res = validatePasswordStrength(input, { role: 'admin' });
    assert.strictEqual(res.valid, false);
  }, `validatePasswordStrength should safely handle input: ${input}`);
}

console.log('✅ All 9 Password Policy Unit Tests Passed Successfully!');
