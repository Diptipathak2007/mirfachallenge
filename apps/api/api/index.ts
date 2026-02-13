import { fastify } from '../src/server';

export default async function handler(req: any, res: any) {
  // 1. Manually set CORS headers for EVERY response
  const setCorsHeaders = (response: any) => {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
  };

  try {
    setCorsHeaders(res);

    // 2. Handle OPTIONS preflight immediately
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // 3. Wait for Fastify to be ready
    await fastify.ready();
    
    // 4. Delegate to Fastify
    fastify.server.emit('request', req, res);
  } catch (error: any) {
    console.error('SERVERLESS_HANDLER_ERROR:', error);
    
    // 5. Ensure even 500 errors have CORS headers
    setCorsHeaders(res);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
