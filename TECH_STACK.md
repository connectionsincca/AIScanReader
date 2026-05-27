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
| **Helmet** | 8.2 | Security HTTP headers (HSTS, XFO, CSP…) | MIT — Free |
| **cors** | 2.8 | CORS policy enforcement | MIT — Free |
| **express-rate-limit** | 8.5 | Three-tier rate limiting (session / OCR / submit) | MIT — Free |
| **dotenv** | 16.3 | Load `.env` file in local development | BSD-2 — Free |
| **openai** | 4.28 | Official OpenAI SDK (GPT-4o calls) | MIT — Free |
| **uuid** | 9.0 | Generate submission IDs for deduplication | MIT — Free |
| **http-proxy-middleware** | 4.0 | Dev-mode proxy: Express → Vite HMR | MIT — Free |
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

### 4b. Cloudflare — Bot Protection & DNS

| Service | Purpose | Cost |
|---|---|---|
| **Cloudflare DNS** | Authoritative DNS for the domain, DDoS protection, CDN | **Free** |
| **Cloudflare Turnstile** | Invisible bot/human verification on the consent step (replaces CAPTCHA) | **Free** (unlimited challenges) |
| **Cloudflare SSL** | Automatic HTTPS certificate via Cloudflare proxy | **Free** |

| Key env vars | |
|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Set before client build — baked into the JS bundle |
| `TURNSTILE_SECRET_KEY` | Server-side verification of Turnstile tokens |

---

### 4c. SMTP Provider — Outbound Email

The app emails completed intake packages (two PDF attachments) to the agency inbox.

| Option | Free tier | Paid | Notes |
|---|---|---|---|
| **Resend** *(recommended)* | 3,000 emails/month, 100/day | $20/month (50k emails) | Best deliverability, easiest setup, dev-friendly |
| **Gmail App Password** | 500/day | Free | Zero setup; sender shows as your Gmail address |
| **Brevo (Sendinblue)** | 300/day | $25/month (20k emails) | Good deliverability on custom domain |

| Key env vars | |
|---|---|
| `SMTP_HOST` | e.g., `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` (STARTTLS on 587) |
| `SMTP_USER` | e.g., `resend` |
| `SMTP_PASS` | SMTP password or API key |
| `SMTP_FROM` | Sender address shown in email |
| `SMTP_FROM_NAME` | Display name shown in email |
| `AGENCY_EMAIL` | Recipient — agency inbox for intake packages |

---

## 5. Hosting & Infrastructure

### 5a. Railway — Application Hosting

| Detail | Value |
|---|---|
| **Plan** | Hobby ($5/month credit included) |
| **What it runs** | Single Node.js process (Express serves API + static files) |
| **Build command** | `npm run build` |
| **Start command** | `node server/dist/index.js` |
| **HTTPS** | Automatic (via Railway's proxy) |
| **Custom domain** | Supported — point CNAME in Cloudflare |
| **Auto-deploy** | On every push to `main` branch |
| **Dashboard** | railway.app |
| **Estimated monthly cost** | $5 – $10 (low-traffic app stays within the $5 credit) |

### 5b. Domain Registrar

| Detail | Value |
|---|---|
| **Registrar options** | Cloudflare Registrar (at-cost pricing), Namecheap, GoDaddy |
| **Estimated cost** | $10 – $15/year (~₹850 – ₹1,250) for a `.com` |
| **Renewal** | Annual |

---

## 6. Monthly Cost Summary

| Item | Cost (USD/month) | Notes |
|---|---|---|
| Railway hosting | $5 – $10 | Scales with usage |
| Domain name | ~$1 | Billed annually (~$12/year) |
| Cloudflare | $0 | Free plan covers all needs |
| SMTP (Resend) | $0 | Free up to 3,000 emails/month |
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

---

## 8. Upgrade & Maintenance Notes

| Dependency | Watch for | Action needed |
|---|---|---|
| `openai` SDK | New GPT-4o model versions with better OCR | Update model string in `openaiService.ts`; re-test extraction prompts |
| `pdfjs-dist` | v5 → v6 breaking changes | Worker URL import path may change; test PDF upload after upgrade |
| `express-rate-limit` | v8 already uses `standardHeaders: 'draft-7'` by default | Review limit headers if upgrading major versions |
| `pdf-lib` | No active major updates as of 2026 | Stable; low upgrade urgency |
| Node.js | LTS transitions (20 → 22 → 24) | Update Railway runtime; test build after upgrade |
| Railway pricing | Check dashboard for plan changes | Adjust budget if pricing tiers change |
| OpenAI pricing | GPT-4o prices have dropped historically | Check platform.openai.com/pricing; update cost table above |
