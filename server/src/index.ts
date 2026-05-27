import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config';
import documentsRouter  from './routes/documents';
import submissionRouter from './routes/submission';
import sessionRouter    from './routes/session';
import { requireSession } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Trust the first reverse proxy (ngrok in dev, Railway/Cloudflare in prod).
// Required so express-rate-limit can read the real client IP from
// X-Forwarded-For instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "https://challenges.cloudflare.com"],
      frameSrc:    ["https://challenges.cloudflare.com"],
      connectSrc:  ["'self'", "https://challenges.cloudflare.com"],
      imgSrc:      ["'self'", "data:", "https:"],
      styleSrc:    ["'self'", "https:", "'unsafe-inline'"],
      fontSrc:     ["'self'", "https:", "data:"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
    },
  },
}));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Tier 1 — Session creation: 10 attempts per 15 min per IP.
 * Prevents someone farming session tokens by scripting Turnstile solvers.
 */
const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many session requests. Please wait 15 minutes and try again.' },
});

/**
 * Tier 2 — OCR endpoints: 60 requests per 15 min per IP.
 * A real user scanning every document (passport, spouse, 4 kids, degree,
 * work certs, IELTS…) makes at most ~40 calls. 60 gives comfortable headroom
 * while capping a bad actor well below quota-exhaustion territory.
 */
const ocrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scan requests. Please wait 15 minutes and try again.' },
});

/**
 * Tier 3 — Submission: 5 per hour per IP.
 * One legitimate submission per session; allows a handful of retries if email
 * fails, but stops bulk submissions from a single IP.
 */
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please wait an hour and try again.' },
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────

// Session endpoint — no auth required (this IS the auth step)
app.use('/api/session', sessionLimiter);
app.use('/api', sessionRouter);

// All document-processing and submission routes require a valid session token
app.use('/api/validate-scan', ocrLimiter);
app.use('/api/extract-data',  ocrLimiter);
app.use('/api/submit',        submitLimiter);
app.use('/api', requireSession, documentsRouter);
app.use('/api', requireSession, submissionRouter);

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
