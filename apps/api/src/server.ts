import 'dotenv/config';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import { encryptEnvelope, unwrapDEK, decryptPayload } from '@mirfa/crypto';
import { store } from './storage.js';
import { fileURLToPath } from 'url';

export const fastify: FastifyInstance = Fastify({
  logger: true
});

// Standard CORS Configuration (Sync-style registration)
fastify.register(fastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
});

// ============================================================================
// MASTER KEY VALIDATION AT API LAYER
// ============================================================================
// DEFENSIVE PROGRAMMING: Validate master key before server starts
// This prevents runtime failures and provides clear error messages
// We check: existence, length (64 hex = 32 bytes), and hex format

/**
 * Validates the master key from environment variables.
 * Returns a validated Buffer or throws an error with a clear message.
 * 
 * Security considerations:
 * - We validate at startup to fail fast
 * - We don't log the actual key value
 * - We provide clear error messages for ops/deployment teams
 */
function validateAndGetMasterKey(): Buffer {
  const MASTER_KEY_HEX = process.env.MASTER_KEY;
  
  // Check 1: Master key must exist
  if (!MASTER_KEY_HEX) {
    throw new Error('MASTER_KEY environment variable is not set');
  }
  
  // Check 2: Must be exactly 64 hex characters (32 bytes)
  if (MASTER_KEY_HEX.length !== 64) {
    throw new Error('MASTER_KEY must be a 64-character hex string (32 bytes)');
  }
  
  // Check 3: Must be valid hexadecimal
  if (!/^[0-9a-fA-F]{64}$/.test(MASTER_KEY_HEX)) {
    throw new Error('MASTER_KEY must contain only hexadecimal characters');
  }
  
  // Convert to Buffer
  return Buffer.from(MASTER_KEY_HEX, 'hex');
}

// Validate master key at startup
// REFACTOR: Do NOT exit process on Vercel if key is missing. 
// This allows OPTIONS requests to succeed even if config is wrong.
let masterKey: Buffer;
try {
  // Only try to load if we are NOT in a build phase or if env is set
  if (process.env.MASTER_KEY) {
    masterKey = validateAndGetMasterKey();
    fastify.log.info('Master key validated successfully');
  } else {
    fastify.log.warn('MASTER_KEY not set at startup - Crypto operations will fail');
  }
} catch (err: any) {
  fastify.log.error({ error: err.message }, 'Master key validation failed');
  // Do not process.exit(1) here for Serverless, let it fail in the route
}

// ============================================================================
// HEALTH CHECK ROUTE
// ============================================================================
fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
  return { status: 'ok' };
});

// ============================================================================
// ROUTE 1: POST /tx/encrypt
// ============================================================================
// Encrypts a payload and stores it in memory.
// 
// VALIDATION STRATEGY:
// - Check request.body exists and is an object
// - Validate partyId: must exist, be a string, and not be empty
// - Validate payload: must exist and not be undefined
// - Return 400 Bad Request with clear, specific error messages
//
// ERROR HANDLING:
// - Crypto errors are caught and returned as generic "Encryption failed"
// - We don't expose internal error details to prevent information leakage
// - All errors are logged internally for debugging

interface EncryptRequestBody {
  partyId: string;
  payload: unknown;
}

fastify.post('/tx/encrypt', async (request: FastifyRequest<{ Body: EncryptRequestBody }>, reply: FastifyReply) => {
  // ========================================
  // STRICT REQUEST VALIDATION
  // ========================================
  
  // Validation 1: Ensure request body exists and is an object
  if (!request.body || typeof request.body !== 'object') {
    return reply.status(400).send({ 
      error: 'Request body must be a valid JSON object' 
    });
  }
  
  const { partyId, payload } = request.body;
  
  // Validation 2: partyId must exist
  if (partyId === undefined || partyId === null) {
    return reply.status(400).send({ 
      error: 'partyId is required' 
    });
  }
  
  // Validation 3: partyId must be a string
  if (typeof partyId !== 'string') {
    return reply.status(400).send({ 
      error: 'partyId must be a string' 
    });
  }
  
  // Validation 4: partyId must not be empty
  if (partyId.trim().length === 0) {
    return reply.status(400).send({ 
      error: 'partyId cannot be empty' 
    });
  }
  
  // Validation 5: payload must exist (allow any object, but not undefined)
  if (payload === undefined) {
    return reply.status(400).send({ 
      error: 'payload is required' 
    });
  }
  
  // ========================================
  // STRUCTURED LOGGING (NO SENSITIVE DATA)
  // ========================================
  fastify.log.info({ partyId }, 'Encrypt request received');
  
  // ========================================
  // ENCRYPTION WITH ERROR HANDLING
  // ========================================
  try {
    if (!masterKey) {
       // Try to load one last time or throw
       if (process.env.MASTER_KEY) masterKey = validateAndGetMasterKey();
       else throw new Error('Configuration Error: MASTER_KEY is missing on server');
    }
    const record = encryptEnvelope(partyId, payload, masterKey);
    store.set(record.id, record);
    
    fastify.log.info({ txId: record.id, partyId }, 'Transaction encrypted and stored');
    
    // Return the full encrypted record (safe to expose)
    return record;
    
  } catch (err: any) {
    // Log the full error internally for debugging
    fastify.log.error({ error: err.message, partyId }, 'Encryption operation failed');
    
    // Return generic error to client (no internal details)
    // This prevents information leakage about our crypto implementation
    return reply.status(400).send({ 
      error: 'Encryption failed' 
    });
  }
});

// ============================================================================
// ROUTE 2: GET /tx/:id
// ============================================================================
// Retrieves an encrypted record by ID.
//
// ERROR HANDLING:
// - Returns 404 if record not found in the in-memory store
// - Clear, user-friendly error message

fastify.get('/tx/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const { id } = request.params;
  
  // Attempt to retrieve record from in-memory store
  const record = store.get(id);
  
  // ========================================
  // RECORD NOT FOUND HANDLING
  // ========================================
  if (!record) {
    fastify.log.warn({ txId: id }, 'Transaction not found');
    return reply.status(404).send({ 
      error: 'Transaction not found' 
    });
  }
  
  fastify.log.info({ txId: id }, 'Transaction retrieved');
  return record;
});

// ============================================================================
// ROUTE 3: POST /tx/:id/decrypt
// ============================================================================
// Decrypts a transaction record and returns the plain payload.
//
// SECURITY CONSIDERATIONS:
// - Wrapped in try/catch to handle crypto errors safely
// - Generic error messages prevent information leakage
// - Failed decryption attempts are logged as warnings (potential tampering)
// - We don't expose why decryption failed (wrong key, corrupted data, etc.)

fastify.post('/tx/:id/decrypt', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const { id } = request.params;
  
  // ========================================
  // STRUCTURED LOGGING
  // ========================================
  fastify.log.info({ txId: id }, 'Decrypt request received');
  
  // Attempt to retrieve record from in-memory store
  const record = store.get(id);
  
  // ========================================
  // RECORD NOT FOUND HANDLING
  // ========================================
  if (!record) {
    fastify.log.warn({ txId: id }, 'Transaction not found for decryption');
    return reply.status(404).send({ 
      error: 'Transaction not found' 
    });
  }
  
  // ========================================
  // SAFE CRYPTO ERROR HANDLING
  // ========================================
  try {
    if (!masterKey) {
       if (process.env.MASTER_KEY) masterKey = validateAndGetMasterKey();
       else throw new Error('Configuration Error: MASTER_KEY is missing on server');
    }
    // Step 1: Unwrap the DEK using the master key
    const dek = unwrapDEK(record, masterKey);
    
    // Step 2: Decrypt the payload using the DEK
    const payload = decryptPayload(record, dek);
    
    fastify.log.info({ txId: id }, 'Transaction decrypted successfully');
    
    // Return the decrypted payload
    return { payload };
    
  } catch (err: any) {
    // Log the full error internally for debugging
    // This could indicate tampering, corrupted data, or wrong key
    fastify.log.warn({ 
      txId: id, 
      error: err.message 
    }, 'Decryption failed - possible tampering or data corruption');
    
    // Return generic error to client
    // SECURITY: We don't reveal WHY decryption failed
    // This prevents attackers from learning about our crypto implementation
    return reply.status(400).send({ 
      error: 'Decryption failed' 
    });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
};

// Only start server if run directly (not imported as a module)
// This allows Vercel to import 'fastify' app without trying to bind to a port
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}
