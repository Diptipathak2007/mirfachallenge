
import { fastify } from '../src/server';

export default async function handler(req: any, res: any) {
  try {
    // 1. Ensure Fastify is ready
    await fastify.ready();
    
    // 2. Delegate to Fastify
    // Fastify will handle the request and set headers as defined in its CORS configuration
    fastify.server.emit('request', req, res);
  } catch (err: any) {
    console.error('SERVERLESS_BOOT_ERROR:', err);
    res.status(500).send({ error: 'Internal Server Error', message: err.message });
  }
}
