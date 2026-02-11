import crypto from 'node:crypto';
import { TxSecureRecord } from './types.js';

const ALG = 'aes-256-gcm';
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Validates that the input is a valid hex string of a specific byte length.
 */
function validateHex(hex: string, expectedByteLength: number, fieldName: string) {
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Invalid hex string for ${fieldName}`);
  }
  if (hex.length !== expectedByteLength * 2) {
    throw new Error(`Invalid length for ${fieldName}: expected ${expectedByteLength} bytes, got ${hex.length / 2}`);
  }
}

/**
 * Generates a 32-byte Data Encryption Key (DEK).
 */
export function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Encrypts a payload using a DEK with AES-256-GCM.
 */
export function encryptPayload(payload: unknown, dek: Buffer) {
  const jsonPayload = JSON.stringify(payload);
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv(ALG, dek, nonce);
  
  const encrypted = Buffer.concat([cipher.update(jsonPayload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    payload_nonce: nonce.toString('hex'),
    payload_ct: encrypted.toString('hex'),
    payload_tag: tag.toString('hex')
  };
}

/**
 * Wraps (encrypts) a DEK using a Master Key (MK).
 */
export function wrapDEK(dek: Buffer, masterKey: Buffer) {
  if (masterKey.length !== KEY_LENGTH) {
    throw new Error(`Invalid Master Key length: expected ${KEY_LENGTH} bytes`);
  }
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv(ALG, masterKey, nonce);
  
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    dek_wrap_nonce: nonce.toString('hex'),
    dek_wrapped: wrapped.toString('hex'),
    dek_wrap_tag: tag.toString('hex')
  };
}

/**
 * Unwraps (decrypts) a DEK using a Master Key (MK).
 */
export function unwrapDEK(record: Pick<TxSecureRecord, 'dek_wrap_nonce' | 'dek_wrapped' | 'dek_wrap_tag'>, masterKey: Buffer): Buffer {
  if (masterKey.length !== KEY_LENGTH) {
    throw new Error(`Invalid Master Key length: expected ${KEY_LENGTH} bytes`);
  }
  validateHex(record.dek_wrap_nonce, NONCE_LENGTH, 'dek_wrap_nonce');
  validateHex(record.dek_wrap_tag, TAG_LENGTH, 'dek_wrap_tag');
  
  if (!/^[0-9a-fA-F]+$/.test(record.dek_wrapped)) {
    throw new Error(`Invalid hex string for dek_wrapped`);
  }
  
  const nonce = Buffer.from(record.dek_wrap_nonce, 'hex');
  const tag = Buffer.from(record.dek_wrap_tag, 'hex');
  const encryptedDEK = Buffer.from(record.dek_wrapped, 'hex');

  const decipher = crypto.createDecipheriv(ALG, masterKey, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(encryptedDEK), decipher.final()]);
  } catch (err) {
    throw new Error('Failed to unwrap DEK: potential tampering or invalid Master Key');
  }
}

/**
 * Decrypts a payload using a DEK.
 */
export function decryptPayload(record: Pick<TxSecureRecord, 'payload_nonce' | 'payload_ct' | 'payload_tag'>, dek: Buffer): unknown {
  validateHex(record.payload_nonce, NONCE_LENGTH, 'payload_nonce');
  validateHex(record.payload_tag, TAG_LENGTH, 'payload_tag');

  if (!/^[0-9a-fA-F]+$/.test(record.payload_ct)) {
    throw new Error(`Invalid hex string for payload_ct`);
  }

  const nonce = Buffer.from(record.payload_nonce, 'hex');
  const tag = Buffer.from(record.payload_tag, 'hex');
  const ciphertext = Buffer.from(record.payload_ct, 'hex');

  const decipher = crypto.createDecipheriv(ALG, dek, nonce);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    throw new Error('Failed to decrypt payload: potential tampering or invalid DEK');
  }
}

/**
 * High-level function to perform envelope encryption.
 */
export function encryptEnvelope(partyId: string, payload: unknown, masterKey: Buffer): TxSecureRecord {
  if (masterKey.length !== KEY_LENGTH) {
    throw new Error(`Invalid Master Key length: expected ${KEY_LENGTH} bytes`);
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  
  const dek = generateDEK();
  const payloadEncryption = encryptPayload(payload, dek);
  const dekWrapping = wrapDEK(dek, masterKey);

  return {
    id,
    partyId,
    createdAt,
    ...payloadEncryption,
    ...dekWrapping,
    alg: "AES-256-GCM",
    mk_version: 1
  };
}
