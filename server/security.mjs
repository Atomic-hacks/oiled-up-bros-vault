import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const id = () => randomBytes(18).toString('hex');
export const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

export function hashPassword(value) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`;
}

export function passwordMatches(value, stored) {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const actual = scryptSync(value, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function roleForEmail(email, ownerEmail, adminEmail) {
  const normalized = String(email).trim().toLowerCase();
  if (normalized && normalized === String(ownerEmail || '').trim().toLowerCase()) return 'OWNER';
  if (normalized && normalized === String(adminEmail || '').trim().toLowerCase()) return 'ADMIN';
  return 'MEMBER';
}

export function setupCodeMatches(candidate, configured) {
  const normalize = (value) => {
    let code = String(value || '').trim();
    const assignment = code.match(/^BOOTSTRAP_CODE\s*=\s*(.+)$/i);
    if (assignment) code = assignment[1].trim();
    if ((code.startsWith('"') && code.endsWith('"')) || (code.startsWith("'") && code.endsWith("'"))) {
      code = code.slice(1, -1).trim();
    }
    return code;
  };
  const candidateCode = normalize(candidate);
  const configuredCode = normalize(configured);
  if (!candidateCode || !configuredCode) return false;
  const actual = Buffer.from(hash(candidateCode));
  const expected = Buffer.from(hash(configuredCode));
  return timingSafeEqual(actual, expected);
}
