
import { fastify } from '../src/server';

export default async function handler(req: any, res: any) {
  // 1. Force CORS headers globally in the wrapper
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 2. Immediate response for OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Ensure Fastify is ready and delegate to the server
  try {
    await fastify.ready();
    fastify.server.emit('request', req, res);
  } catch (err: any) {
    res.status(500).send({ error: 'Internal Server Error', message: err.message });
  }
}
