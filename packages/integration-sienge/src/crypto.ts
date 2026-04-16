import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const EXPECTED_KEY_LENGTH = 32; // 256 bits

/**
 * Returns the encryption key from the environment.
 * Expects a 32-byte hex string.
 */
function getEncryptionKey(): Buffer {
  const hexKey = process.env.SIENGE_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('SIENGE_ENCRYPTION_KEY environment variable is not defined.');
  }
  
  const keyBuffer = Buffer.from(hexKey, 'hex');
  if (keyBuffer.length !== EXPECTED_KEY_LENGTH) {
    throw new Error(`SIENGE_ENCRYPTION_KEY must be a ${EXPECTED_KEY_LENGTH}-byte hex string.`);
  }

  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The result is formatted as "ivHex:authTagHex:encryptedHex".
 */
export function encryptSiengeCredential(plaintext: string): string {
  const keyBuffer = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an encrypted credential formatted as "ivHex:authTagHex:encryptedHex".
 */
export function decryptSiengeCredential(encryptedText: string): string {
  const keyBuffer = getEncryptionKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format. Expected iv:authTag:encrypted');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex as string, 'hex');
  const authTag = Buffer.from(authTagHex as string, 'hex');
  const encrypted = Buffer.from(encryptedHex as string, 'hex');

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
