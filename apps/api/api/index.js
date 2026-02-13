import { fastify } from '../src/server.js';

export default async function handler(req, res) {
  await fastify.ready();
  fastify.server.emit('request', req, res);
}
