import * as Crypto from 'expo-crypto';

const HASH_PREFIX = 'sha256';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Format: sha256$<saltHex>$<digestHex>
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  const salt = toHex(Crypto.getRandomBytes(16));
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );

  return `${HASH_PREFIX}$${salt}$${digest}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  if (typeof password !== 'string' || typeof passwordHash !== 'string') {
    return false;
  }

  const parts = passwordHash.split('$');
  if (parts.length !== 3) {
    return false;
  }

  const [prefix, salt, digest] = parts;
  if (prefix !== HASH_PREFIX || !salt || !digest) {
    return false;
  }

  const attempt = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );

  return attempt.toLowerCase() === digest.toLowerCase();
}
