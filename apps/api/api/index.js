import { fastify } from '../src/server.js';

export default async function handler(req, res) {
  // MANUALLY INJECT CORS HEADERS (The "Nuclear Option")
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  await fastify.ready();
  fastify.server.emit('request', req, res);
}
