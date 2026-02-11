import 'dotenv/config';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { encryptEnvelope, unwrapDEK, decryptPayload } from '@mirfa/crypto';
import { store } from './storage.js';

const fastify: FastifyInstance = Fastify({
  logger: true
});

// Master Key handling
const MASTER_KEY_HEX = process.env.MASTER_KEY;
if (!MASTER_KEY_HEX) {
  console.error('CRITICAL: MASTER_KEY environment variable is not set');
  process.exit(1);
}
if (MASTER_KEY_HEX.length !== 64) {
  console.error('CRITICAL: MASTER_KEY must be a 64-character hex string (32 bytes)');
  process.exit(1);
}

const masterKey = Buffer.from(MASTER_KEY_HEX, 'hex');

// Health check route
fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
  return { status: 'ok' };
});

/**
 * 1. POST /tx/encrypt
 * Encrypts a payload and stores it in memory.
 */
interface EncryptRequestBody {
  partyId: string;
  payload: unknown;
}

fastify.post('/tx/encrypt', async (request: FastifyRequest<{ Body: EncryptRequestBody }>, reply: FastifyReply) => {
  const { partyId, payload } = request.body;

  if (!partyId || !payload) {
    return reply.status(400).send({ error: 'partyId and payload are required' });
  }

  try {
    const record = encryptEnvelope(partyId, payload, masterKey);
    store.set(record.id, record);
    
    fastify.log.info({ txId: record.id, partyId }, 'Transaction encrypted and stored');
    return record;
  } catch (err: any) {
    fastify.log.error(err, 'Encryption failed');
    return reply.status(400).send({ error: 'Encryption failed', message: err.message });
  }
});

/**
 * 2. GET /tx/:id
 * Retrieves an encrypted record by ID.
 */
fastify.get('/tx/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const { id } = request.params;
  const record = store.get(id);

  if (!record) {
    return reply.status(404).send({ error: 'Transaction not found' });
  }

  return record;
});

/**
 * 3. POST /tx/:id/decrypt
 * Decrypts a transaction record and returns the plain payload.
 */
fastify.post('/tx/:id/decrypt', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const { id } = request.params;
  const record = store.get(id);

  if (!record) {
    return reply.status(404).send({ error: 'Transaction not found' });
  }

  try {
    const dek = unwrapDEK(record, masterKey);
    const payload = decryptPayload(record, dek);
    
    fastify.log.info({ txId: id }, 'Transaction decrypted successfully');
    return { payload };
  } catch (err: any) {
    fastify.log.error(err, 'Decryption failed');
    return reply.status(400).send({ error: 'Decryption failed', message: err.message });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
