
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import crypto from 'node:crypto';

// ============================================================================
// CORE TYPES (Inlined)
// ============================================================================
export interface TxSecureRecord {
  id: string;
  partyId: string;
  createdAt: string;
  payload_nonce: string;
  payload_ct: string;
  payload_tag: string;
  dek_wrap_nonce: string;
  dek_wrapped: string;
  dek_wrap_tag: string;
  alg: string;
  mk_version: number;
}

// ============================================================================
// STORAGE (Inlined Singleton)
// ============================================================================
const store = new Map<string, TxSecureRecord>();

// ============================================================================
// CRYPTO LOGIC (Inlined from @mirfa/crypto)
// ============================================================================
const ALG = 'aes-256-gcm';
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function validateHex(hex: string, expectedByteLength: number, fieldName: string) {
  if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error(`Invalid hex string for ${fieldName}`);
  if (hex.length !== expectedByteLength * 2) throw new Error(`Invalid length for ${fieldName}`);
}

function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

function encryptPayload(payload: unknown, dek: Buffer) {
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

function wrapDEK(dek: Buffer, masterKey: Buffer) {
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

function unwrapDEK(record: any, masterKey: Buffer): Buffer {
  validateHex(record.dek_wrap_nonce, NONCE_LENGTH, 'dek_wrap_nonce');
  validateHex(record.dek_wrap_tag, TAG_LENGTH, 'dek_wrap_tag');
  const nonce = Buffer.from(record.dek_wrap_nonce, 'hex');
  const tag = Buffer.from(record.dek_wrap_tag, 'hex');
  const encryptedDEK = Buffer.from(record.dek_wrapped, 'hex');
  const decipher = crypto.createDecipheriv(ALG, masterKey, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encryptedDEK), decipher.final()]);
}

function decryptPayload(record: any, dek: Buffer): unknown {
  validateHex(record.payload_nonce, NONCE_LENGTH, 'payload_nonce');
  validateHex(record.payload_tag, TAG_LENGTH, 'payload_tag');
  const nonce = Buffer.from(record.payload_nonce, 'hex');
  const tag = Buffer.from(record.payload_tag, 'hex');
  const ciphertext = Buffer.from(record.payload_ct, 'hex');
  const decipher = crypto.createDecipheriv(ALG, dek, nonce);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function encryptEnvelope(partyId: string, payload: unknown, masterKey: Buffer): TxSecureRecord {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const dek = generateDEK();
  const payloadEncryption = encryptPayload(payload, dek);
  const dekWrapping = wrapDEK(dek, masterKey);
  return {
    id, partyId, createdAt,
    ...payloadEncryption,
    ...dekWrapping,
    alg: "AES-256-GCM",
    mk_version: 1
  };
}

// ============================================================================
// API SETUP
// ============================================================================
const fastify = Fastify({ logger: true });

function getMasterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key || key.length !== 64) throw new Error('Invalid MASTER_KEY');
  return Buffer.from(key, 'hex');
}

// Routes
fastify.get('/', async () => ({ status: 'ok' }));

fastify.post('/tx/encrypt', async (req: any, reply) => {
  try {
    const { partyId, payload } = req.body;
    const mk = getMasterKey();
    const record = encryptEnvelope(partyId, payload, mk);
    store.set(record.id, record);
    return record;
  } catch (err: any) {
    return reply.status(400).send({ error: err.message });
  }
});

fastify.get('/tx/:id', async (req: any, reply) => {
  const record = store.get(req.params.id);
  if (!record) return reply.status(404).send({ error: 'Not found' });
  return record;
});

fastify.post('/tx/:id/decrypt', async (req: any, reply) => {
  try {
    const record = store.get(req.params.id);
    if (!record) return reply.status(404).send({ error: 'Not found' });
    const mk = getMasterKey();
    const dek = unwrapDEK(record, mk);
    const payload = decryptPayload(record, dek);
    return { payload };
  } catch (err: any) {
    return reply.status(400).send({ error: 'Decryption failed' });
  }
});

// ============================================================================
// VERCEL HANDLER
// ============================================================================
export default async function handler(req: any, res: any) {
  // CORS - FORCED HEADERS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await fastify.ready();
    fastify.server.emit('request', req, res);
  } catch (err: any) {
    res.status(500).send({ error: 'Boot error', message: err.message });
  }
}
