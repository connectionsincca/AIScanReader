import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config';
import documentsRouter  from './routes/documents';
import submissionRouter from './routes/submission';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────

app.use('/api', documentsRouter);
app.use('/api', submissionRouter);

// ── Frontend serving ──────────────────────────────────────────────────────────

const clientDist = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  const vitePort = parseInt(process.env.VITE_PORT ?? '5174', 10);
  const viteTarget = `http://localhost:${vitePort}`;

  const viteProxy = createProxyMiddleware({
    target: viteTarget,
    changeOrigin: true,
    ws: true,
    logger: console,
  });

  app.use(viteProxy);
}

// ── Error handler ─────────────────────────────────────────────────────────────

app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────

const server = http.createServer(app);

if (!fs.existsSync(clientDist)) {
  const vitePort = parseInt(process.env.VITE_PORT ?? '5174', 10);
  const wsProxy = createProxyMiddleware({
    target: `http://localhost:${vitePort}`,
    changeOrigin: true,
    ws: true,
  });
  server.on('upgrade', wsProxy.upgrade as Parameters<typeof server.on>[1]);
}

server.listen(config.port, () => {
  console.log(`\n  Immigration Intake Portal`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Local:  http://localhost:${config.port}`);
  console.log(`  Env:    ${config.nodeEnv}\n`);
});
