import crypto from 'node:crypto';
import { encryptEnvelope, decryptPayload, unwrapDEK } from './src/index.js';

const masterKey = crypto.randomBytes(32);
const payload = { amount: 100, currency: 'USD', note: 'Secret transaction' };
const partyId = 'user_123';

console.log('--- Phase 3 Extended Verification Start ---');

try {
  // 1. Correct Flow
  console.log('1. Testing correct encryption/decryption flow...');
  const record = encryptEnvelope(partyId, payload, masterKey);
  const dek = unwrapDEK(record, masterKey);
  const decryptedPayload = decryptPayload(record, dek);
  console.log('SUCCESS: Payload decrypted successfully');

  // 2. Tamper Tag
  console.log('\n2. Testing tampered tag...');
  const tamperedTagRecord = { ...record, payload_tag: record.payload_tag.slice(0, -2) + '00' };
  try {
    decryptPayload(tamperedTagRecord, dek);
    console.error('FAILURE: Tampered tag should have thrown');
  } catch (err: any) {
    console.log('SUCCESS: Caught tampered tag:', err.message);
  }

  // 3. Wrong Nonce Length
  console.log('\n3. Testing wrong nonce length...');
  const wrongNonceRecord = { ...record, payload_nonce: record.payload_nonce + 'ff' };
  try {
    decryptPayload(wrongNonceRecord, dek);
    console.error('FAILURE: Wrong nonce length should have thrown');
  } catch (err: any) {
    console.log('SUCCESS: Caught wrong nonce length:', err.message);
  }

  // 4. Invalid Hex String
  console.log('\n4. Testing invalid hex string in nonce...');
  const invalidHexRecord = { ...record, payload_nonce: 'G'.repeat(record.payload_nonce.length) };
  try {
    decryptPayload(invalidHexRecord, dek);
    console.error('FAILURE: Invalid hex string should have thrown');
  } catch (err: any) {
    console.log('SUCCESS: Caught invalid hex string:', err.message);
  }

  // 5. Ciphertext Hex Validation
  console.log('\n5. Testing invalid hex string in ciphertext...');
  const invalidCipherHexRecord = { ...record, payload_ct: 'G'.repeat(record.payload_ct.length) };
  try {
    decryptPayload(invalidCipherHexRecord, dek);
    console.error('FAILURE: Invalid ciphertext hex should have thrown');
  } catch (err: any) {
    console.log('SUCCESS: Caught invalid ciphertext hex:', err.message);
  }

  // 6. MasterKey Validation in unwrapDEK
  console.log('\n6. Testing wrong Master Key length in unwrapDEK...');
  try {
    unwrapDEK(record, crypto.randomBytes(16));
    console.error('FAILURE: Small Master Key should have thrown in unwrapDEK');
  } catch (err: any) {
    console.log('SUCCESS: Caught small Master Key in unwrapDEK:', err.message);
  }

  // 7. MasterKey Validation in encryptEnvelope
  console.log('\n7. Testing wrong Master Key length in encryptEnvelope...');
  try {
    encryptEnvelope(partyId, payload, crypto.randomBytes(16));
    console.error('FAILURE: Small Master Key should have thrown in encryptEnvelope');
  } catch (err: any) {
    console.log('SUCCESS: Caught small Master Key in encryptEnvelope:', err.message);
  }

  // 8. Tamper Ciphertext
  console.log('\n8. Testing tampered ciphertext...');
  const tamperedCipherRecord = { ...record, payload_ct: record.payload_ct.slice(0, -2) + (record.payload_ct.endsWith('00') ? '11' : '00') };
  try {
    decryptPayload(tamperedCipherRecord, dek);
    console.error('FAILURE: Tampered ciphertext should have thrown');
  } catch (err: any) {
    console.log('SUCCESS: Caught tampered ciphertext:', err.message);
  }

} catch (err: any) {
  console.error('CRITICAL ERROR during verification:', err.message);
  process.exit(1);
}

console.log('\n--- Phase 3 Extended Verification End ---');
