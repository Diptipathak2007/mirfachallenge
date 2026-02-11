import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const fastify: FastifyInstance = Fastify({
  logger: true
});

// Health check route
fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
  return { status: 'ok' };
});

// Phase 2 Placeholder Routes

// POST /tx/encrypt
fastify.post('/tx/encrypt', async (request: FastifyRequest, reply: FastifyReply) => {
  fastify.log.info('Encrypt request received');
  return {
    message: "Encrypt endpoint placeholder"
  };
});

// GET /tx/:id
fastify.get('/tx/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const { id } = request.params;
  fastify.log.info({ txId: id }, 'Get transaction request received');
  return {
    message: "Get transaction placeholder",
    id
  };
});

// POST /tx/:id/decrypt
fastify.post('/tx/:id/decrypt', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const { id } = request.params;
  fastify.log.info({ txId: id }, 'Decrypt request received');
  return {
    message: "Decrypt endpoint placeholder",
    id
  };
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
