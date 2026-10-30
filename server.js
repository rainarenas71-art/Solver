// server.js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { solveWaf } from './solver.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const API_KEY = process.env.API_KEY;
if (!API_KEY) { app.log.error('API_KEY required'); process.exit(1); }

app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health') return;
  if (req.headers['x-api-key'] !== API_KEY) reply.code(401).send({ error: 'unauthorized' });
});

app.get('/health', async () => ({ ok: true }));

// ENDPOINT PARA SA COOKIES
app.post('/harvest', async (req, reply) => {
  try {
    const result = await solveWaf();
    if (!result.ok) return reply.code(502).send({ ok: false, error: 'WAF failed' });
    
    // Ifo-format natin as string: acw_tc=...; ssxmod_itna=...;
    const cookieString = result.cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    return { ok: true, cookies: cookieString };
  } catch (e) {
    return reply.code(500).send({ ok: false, error: e.message });
  }
});

const port = Number(process.env.PORT || 10000);
await app.listen({ port, host: '0.0.0.0' });