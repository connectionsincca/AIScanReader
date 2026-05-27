# Tech Stack & Cost Register

Living reference for all technologies and platforms in the **Immigration Intake Portal**.  
Update this file whenever a dependency is added, upgraded, or replaced, or when pricing changes.

**Last updated:** 2026-05-27

---

## 1. Frontend (Client)

Runs in the user's browser. Built by Vite into static files served by the Express server.

| Technology | Version | Purpose | License / Cost |
|---|---|---|---|
| **React** | 18.2 | UI component framework | MIT — Free |
| **TypeScript** | 5.3 | Static typing for JavaScript | Apache 2.0 — Free |
| **Vite** | 5.1 | Build tool & dev server (HMR) | MIT — Free |
| **Tailwind CSS** | 3.4 | Utility-first CSS framework | MIT — Free |
| **Axios** | 1.6 | HTTP client for API calls | MIT — Free |
| **pdfjs-dist** | 5.7 | Render uploaded PDFs to images client-side | Apache 2.0 — Free |
| **PostCSS** | 8.4 | CSS processing (Tailwind pipeline) | MIT — Free |
| **Autoprefixer** | 10.4 | CSS vendor prefix automation | MIT — Free |

---

## 2. Backend (Server)

Runs as a single Node.js process. Serves both the API and the built React static files.

| Technology | Version | Purpose | License / Cost |
|---|---|---|---|
| **Node.js** | 20 LTS | JavaScript runtime | MIT — Free |
| **TypeScript** | 5.3 | Static typing for JavaScript | Apache 2.0 — Free |
| **Express** | 4.18 | Web framework / HTTP server | MIT — Free |
| **pdf-lib** | 1.17 | Generate intake form PDFs in memory | MIT — Free |
| **Nodemailer** | 6.9 | Send emails with PDF attachments | MIT — Free |
| **Helmet** | 8.2 | Security HTTP headers with custom CSP allowing Cloudflare Turnstile | MIT — Free |
| **cors** | 2.8 | CORS policy enforcement | MIT — Free |
| **express-rate-limit** | 8.5 | Three-tier rate limiting (session / OCR / submit) | MIT — Free |
| **dotenv** | 16.3 | Load `.env` file in local development | BSD-2 — Free |
| **openai** | 4.28 | Official OpenAI SDK (GPT-4o calls) | MIT — Free |
| **uuid** | 9.0 | Generate submission IDs for deduplication | MIT — Free |
| **http-proxy-middleware** | **2.x** | Dev-mode proxy: Express → Vite HMR. Pinned to v2 — v4 is ESM-only and incompatible with CommonJS compilation target | MIT — Free |
| **selfsigned** | 5.5 | (Dev only) Generate self-signed HTTPS cert for mobile camera testing | MIT — Free |

---

## 3. Dev Tooling

Used only during development; not deployed.

| Tool | Version | Purpose | Cost |
|---|---|---|---|
| **nodemon** | 3.0 | Auto-restart server on file save | Free |
| **ts-node** | 10.9 | Run TypeScript directly (dev server) | Free |
| **concurrently** | 8.2 | Run Vite + Express in one terminal | Free |
| **cross-env** | 7.0 | Set env vars in npm scripts cross-platform | Free |
| **Git** | — | Source control | Free |
| **ngrok** | — | HTTPS tunnel for local mobile/UAT testing | Free (1 static domain on free plan) |

---

## 4. External Services & APIs

These are third-party services the running application calls at runtime.

### 4a. OpenAI — AI / OCR

| Detail | Value |
|---|---|
| **Model used** | GPT-4o (`gpt-4o`) |
| **Validation calls** | Low-detail image (~85 tokens/image) — checks document type |
| **Extraction calls** | High-detail image (varies by page size) — OCR extracts form fields |
| **Pricing (as of 2026-05)** | Input: $2.50 / 1M tokens · Output: $10.00 / 1M tokens |
| **Estimated cost per intake** | ~$0.05 – $0.15 (depends on number of documents scanned) |
| **Dashboard** | platform.openai.com/usage |
| **Key env var** | `OPENAI_API_KEY` |

> **Cost driver:** Each document upload triggers two API calls (validate + extract). An applicant with spouse + 2 children + IELTS + work certs + degree certs could scan 10–15 documents. Budget $0.15 as the worst-case ceiling per submission.

---

### 4b. Cloudflare — Bot Protection

| Service | Purpose | Cost |
|---|---|---|
| **Cloudflare Turnstile** | Invisible bot/human verification on the consent step (replaces CAPTCHA) | **Free** (unlimited challenges) |

> **DNS status:** DNS is currently managed by **Wix** (nameservers: `ns12.wixdns.net`, `ns13.wixdns.net`). Wix does not allow editing NS records from the DNS panel. Moving DNS to Cloudflare is a planned future step — will be done when transferring domain ownership away from Wix.

| Key env vars | |
|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Set before client build — baked into the JS bundle |
| `TURNSTILE_SECRET_KEY` | Server-side verification of Turnstile tokens |

---

### 4c. SMTP Provider — Outbound Email

Currently using **Gmail App Password** (free, zero setup).

| Detail | Value |
|---|---|
| **Provider** | Gmail (smtp.gmail.com) |
| **Cost** | Free |
| **Daily limit** | 500 emails/day |
| **Attachment limit** | 25 MB per email |
| **Setup** | Gmail account → myaccount.google.com/apppasswords → generate App Password |

> **Sender address** shows as the Gmail account (e.g. `info@connectionsink.ca` or personal Gmail). For a branded `noreply@connectionsink.ca` sender, switch to Resend or Brevo in future.

| Key env vars | |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | 16-char App Password |
| `SMTP_FROM` | Gmail address (sender) |
| `SMTP_FROM_NAME` | Display name on emails |
| `AGENCY_EMAIL` | Tanon Immigration's inbox (recipient of all intake packages) |

---

## 5. Hosting & Infrastructure

### 5a. Railway — Application Hosting

| Detail | Value |
|---|---|
| **Plan** | Hobby ($5/month credit included) |
| **Project name** | observant-bravery (Railway auto-generated) |
| **Production URL** | `https://scai.connectionsinc.ca` |
| **Railway internal URL** | auto-generated `.up.railway.app` domain |
| **What it runs** | Single Node.js process (Express serves API + static files) |
| **Build command** | `npm run build` |
| **Start command** | `node server/dist/index.js` |
| **Port** | 3001 |
| **HTTPS** | Automatic (Railway edge + Let's Encrypt for custom domain) |
| **Custom domain** | `scai.connectionsinc.ca` — CNAME set in Wix DNS |
| **Auto-deploy** | On every push to `main` branch |
| **Dashboard** | railway.app |
| **Estimated monthly cost** | $5 – $10 (low-traffic app stays within the $5 credit) |

> **Railway build gotcha:** Nixpacks sets `NODE_ENV=production` during the install phase, which causes `npm install` to skip `devDependencies`. TypeScript and Vite are in `devDependencies` and are needed for the build. Fix: use `npm install --include=dev` in the `install:all` script (already applied in `package.json`).

### 5b. Domain

| Detail | Value |
|---|---|
| **Domain** | `connectionsinc.ca` |
| **Registrar** | Wix (domain purchased through Wix) |
| **DNS management** | Wix DNS (ns12.wixdns.net / ns13.wixdns.net) |
| **Subdomain in use** | `scai.connectionsinc.ca` → Railway |
| **Future plan** | Transfer domain ownership to Cloudflare Registrar (supports `.ca`) when moving away from Wix |
| **Estimated cost** | ~$15 CAD/year |

### 5c. UAT / Testing Environment

| Detail | Value |
|---|---|
| **Tool** | ngrok (free static domain) |
| **UAT URL** | `https://bonelike-remover-discount.ngrok-free.dev` |
| **How it works** | Tunnels `localhost:3001` to a public HTTPS URL |
| **OpenAI key** | Personal key (separate from production) |
| **Limitation** | Only works while local server + ngrok are running |
| **Best for** | Personal testing, mobile camera testing |

---

## 6. Monthly Cost Summary

| Item | Cost (USD/month) | Notes |
|---|---|---|
| Railway hosting | $5 – $10 | Scales with usage |
| Domain name (`connectionsinc.ca`) | ~$1 | Billed annually (~$15 CAD/year via Wix) |
| Cloudflare Turnstile | $0 | Free plan, unlimited challenges |
| SMTP (Gmail) | $0 | Free, 500 emails/day |
| OpenAI API | Variable | See per-intake estimate below |
| **Fixed monthly total** | **~$6 – $11** | Excluding OpenAI |

### OpenAI — per intake estimate

| Volume | Monthly AI cost |
|---|---|
| 10 intakes/month | ~$0.50 – $1.50 |
| 50 intakes/month | ~$2.50 – $7.50 |
| 200 intakes/month | ~$10 – $30 |
| 500 intakes/month | ~$25 – $75 |

> At high volume, set a **spending limit** in the OpenAI dashboard (Settings → Limits) to cap unexpected costs.

---

## 7. Technology Decision Log

Record major decisions here so future maintainers understand the *why*.

| Date | Decision | Reason |
|---|---|---|
| 2026-05 | **pdf-lib** for PDF generation (not Puppeteer/wkhtmltopdf) | Zero native dependencies — works on Railway without a headless Chrome install; generates PDFs fully in memory with no disk writes |
| 2026-05 | **pdfjs-dist** for client-side PDF rendering | Avoids sending raw PDF bytes to the server for preview; user sees pages before uploading |
| 2026-05 | **Single Express server** for both API and static files | Simplest possible deployment — one Railway service, one port, no separate CDN config needed |
| 2026-05 | **Cloudflare Turnstile** (not reCAPTCHA or hCaptcha) | Privacy-friendly (no tracking cookies), invisible mode works without user interaction, free unlimited challenges |
| 2026-05 | **In-memory session store** (not Redis/DB) | The app is single-instance, sessions are short-lived (4h), and keeping state in-process is zero-dependency. If the app scales to multiple instances, swap `sessionStore.ts` for Redis |
| 2026-05 | **Railway** over Vercel/Netlify | The app is a persistent Express server, not serverless. Railway runs it as a long-lived process without cold starts |
| 2026-05 | **Downgraded http-proxy-middleware to v2** | v4 is ESM-only; server compiles to CommonJS. `require()` of an ESM package fails at startup even though the proxy is never used in production. v2 is CJS-compatible |
| 2026-05 | **Custom helmet CSP** (not default) | Default `helmet()` blocks all external scripts via `script-src 'self'`. This silently blocked the Cloudflare Turnstile script, causing `window.turnstile` to be `undefined` and all session requests to fail with 403 |
| 2026-05 | **Gmail SMTP** (not Resend) | Internal agency tool sending one email per submission. Gmail free tier (500/day) is more than sufficient. 25 MB attachment limit comfortably covers the two PDF attachments. Zero setup cost |

---

## 8. Upgrade & Maintenance Notes

| Dependency | Watch for | Action needed |
|---|---|---|
| `openai` SDK | New GPT-4o model versions with better OCR | Update model string in `openaiService.ts`; re-test extraction prompts |
| `pdfjs-dist` | v5 → v6 breaking changes | Worker URL import path may change; test PDF upload after upgrade |
| `express-rate-limit` | v8 already uses `standardHeaders: 'draft-7'` by default | Review limit headers if upgrading major versions |
| `pdf-lib` | No active major updates as of 2026 | Stable; low upgrade urgency |
| `http-proxy-middleware` | Stay on v2.x | v3+ dropped CJS support. Only upgrade if server is migrated to ESM output |
| Node.js | LTS transitions (20 → 22 → 24) | Update Railway runtime; test build after upgrade |
| Railway pricing | Check dashboard for plan changes | Adjust budget if pricing tiers change |
| OpenAI pricing | GPT-4o prices have dropped historically | Check platform.openai.com/pricing; update cost table above |
| Gmail SMTP | 500/day limit | If submission volume exceeds ~400/day, switch to Resend or SendGrid |
