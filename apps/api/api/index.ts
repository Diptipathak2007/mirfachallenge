
import { fastify } from '../src/server';

export default async function handler(req: any, res: any) {
  // 1. MANUALLY INJECT CORS HEADERS (Double Insurance)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // 2. IMMEDIATE SUCCESS FOR OPTIONS (Preflight)
  // This bypasses Fastify's boot/routing logic for preflights
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 3. Ensure Fastify is ready
    await fastify.ready();
    
    // 4. Delegate to Fastify
    fastify.server.emit('request', req, res);
  } catch (err: any) {
    console.error('SERVERLESS_BOOT_ERROR:', err);
    // Ensure error response also has CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).send({ error: 'Internal Server Error', message: err.message });
  }
}
