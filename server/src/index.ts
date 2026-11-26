import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config.js';
import { errorHandler } from './http.js';
import { api } from './routes/index.js';
import { startWorker } from './services/worker.js';

const app = express();
const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim());

app.use(helmet());
app.use(cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)), credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);
app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
app.use(errorHandler);

const isDirectRun = process.argv[1]?.endsWith('/dist/index.js') || process.argv[1]?.endsWith('/src/index.ts');

if (isDirectRun) {
  app.listen(env.PORT, () => {
    console.log(`StudyMate API di http://localhost:${env.PORT}`);
    if (env.ENABLE_WORKER === 'true') startWorker();
  });
}

export default app;
