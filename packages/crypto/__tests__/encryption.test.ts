import crypto from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptEnvelope, decryptPayload, unwrapDEK } from '../src/index.js';

// ============================================================================
// TEST SUITE: ENVELOPE ENCRYPTION
// ============================================================================

describe('Envelope Encryption', () => {
  let masterKey: Buffer;
  let payload: Record<string, unknown>;
  let partyId: string;

  // --------------------------------------------------------------------------
  // SETUP: Generate fresh master key before each test
  // --------------------------------------------------------------------------
  beforeEach(() => {
    masterKey = crypto.randomBytes(32); // 256-bit master key
    payload = { amount: 100, currency: 'USD', note: 'Secret transaction' };
    partyId = 'user_123';
  });

  // ==========================================================================
  // SUCCESSFUL ENCRYPTION/DECRYPTION
  // ==========================================================================
  describe('Successful Encryption/Decryption', () => {
    it('should encrypt and decrypt payload successfully', () => {
      // Encrypt the payload
      const record = encryptEnvelope(partyId, payload, masterKey);

      // Verify record structure
      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('partyId', partyId);
      expect(record).toHaveProperty('payload_nonce');
      expect(record).toHaveProperty('payload_ct');
      expect(record).toHaveProperty('payload_tag');
      expect(record).toHaveProperty('dek_wrapped');
      expect(record).toHaveProperty('alg', 'AES-256-GCM');

      // Unwrap DEK
      const dek = unwrapDEK(record, masterKey);
      expect(dek).toBeInstanceOf(Buffer);
      expect(dek.length).toBe(32); // 256-bit DEK

      // Decrypt payload
      const decryptedPayload = decryptPayload(record, dek);
      expect(decryptedPayload).toEqual(payload);
    });
  });

  // ==========================================================================
  // INTEGRITY VALIDATION (AES-GCM AUTHENTICATION)
  // ==========================================================================
  describe('Integrity Validation', () => {
    it('should throw when payload_tag is tampered', () => {
      // Encrypt payload
      const record = encryptEnvelope(partyId, payload, masterKey);
      const dek = unwrapDEK(record, masterKey);

      // Tamper with authentication tag
      const tamperedRecord = {
        ...record,
        payload_tag: record.payload_tag.slice(0, -2) + '00'
      };

      // Attempt to decrypt should throw
      expect(() => {
        decryptPayload(tamperedRecord, dek);
      }).toThrow();
    });

    it('should throw when payload_ct is tampered', () => {
      // Encrypt payload
      const record = encryptEnvelope(partyId, payload, masterKey);
      const dek = unwrapDEK(record, masterKey);

      // Tamper with ciphertext
      const tamperedRecord = {
        ...record,
        payload_ct: record.payload_ct.slice(0, -2) + (record.payload_ct.endsWith('00') ? '11' : '00')
      };

      // Attempt to decrypt should throw
      expect(() => {
        decryptPayload(tamperedRecord, dek);
      }).toThrow();
    });
  });

  // ==========================================================================
  // INPUT VALIDATION
  // ==========================================================================
  describe('Input Validation', () => {
    it('should throw when nonce has wrong length', () => {
      // Encrypt payload
      const record = encryptEnvelope(partyId, payload, masterKey);
      const dek = unwrapDEK(record, masterKey);

      // Create record with wrong nonce length (add extra bytes)
      const wrongNonceRecord = {
        ...record,
        payload_nonce: record.payload_nonce + 'ff'
      };

      // Attempt to decrypt should throw
      expect(() => {
        decryptPayload(wrongNonceRecord, dek);
      }).toThrow();
    });

    it('should throw when nonce contains invalid hex', () => {
      // Encrypt payload
      const record = encryptEnvelope(partyId, payload, masterKey);
      const dek = unwrapDEK(record, masterKey);

      // Create record with invalid hex characters in nonce
      const invalidHexRecord = {
        ...record,
        payload_nonce: 'G'.repeat(record.payload_nonce.length)
      };

      // Attempt to decrypt should throw
      expect(() => {
        decryptPayload(invalidHexRecord, dek);
      }).toThrow();
    });

    it('should throw when ciphertext contains invalid hex', () => {
      // Encrypt payload
      const record = encryptEnvelope(partyId, payload, masterKey);
      const dek = unwrapDEK(record, masterKey);

      // Create record with invalid hex characters in ciphertext
      const invalidCipherHexRecord = {
        ...record,
        payload_ct: 'G'.repeat(record.payload_ct.length)
      };

      // Attempt to decrypt should throw
      expect(() => {
        decryptPayload(invalidCipherHexRecord, dek);
      }).toThrow();
    });
  });

  // ==========================================================================
  // MASTER KEY VALIDATION
  // ==========================================================================
  describe('Master Key Validation', () => {
    it('should throw when master key is wrong length in unwrapDEK', () => {
      // Encrypt payload with correct master key
      const record = encryptEnvelope(partyId, payload, masterKey);

      // Attempt to unwrap DEK with wrong master key length (16 bytes instead of 32)
      const wrongMasterKey = crypto.randomBytes(16);

      expect(() => {
        unwrapDEK(record, wrongMasterKey);
      }).toThrow(/Invalid Master Key length: expected 32 bytes/);
    });

    it('should throw when master key is wrong length in encryptEnvelope', () => {
      // Attempt to encrypt with wrong master key length (16 bytes instead of 32)
      const wrongMasterKey = crypto.randomBytes(16);

      expect(() => {
        encryptEnvelope(partyId, payload, wrongMasterKey);
      }).toThrow(/Invalid Master Key length: expected 32 bytes/);
    });
  });
});
