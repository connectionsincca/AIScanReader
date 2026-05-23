# Immigration Intake Portal

A responsive, production-ready web application for scanning and submitting immigration documents.

## Features

- Camera scanning with real-time visual guidance
- Scan quality validation (blur, lighting, glare)
- AI document type verification (rejects wrong document types)
- AI/OCR extraction with OpenAI gpt-4o vision
- Auto-populated intake form with confidence indicators
- PDF generation (scanned docs + completed form)
- Secure email delivery to immigration agency
- No permanent storage — all data deleted after submission
- Fully responsive (desktop, tablet, mobile)

## Project Structure

```
├── client/          # React + TypeScript + Tailwind frontend
└── server/          # Node.js + Express backend
```

## Prerequisites

- Node.js 18+
- An OpenAI API key (gpt-4o access required)
- An SMTP service (Gmail, SendGrid, etc.)

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env` and fill in:

```env
OPENAI_API_KEY=sk-...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password      # Gmail: use App Password, not your main password
SMTP_FROM=noreply@yourportal.com
AGENCY_EMAIL=intake@agency.com
CLIENT_URL=http://localhost:5173
```

**Gmail Setup:**
1. Enable 2FA on your Google account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an App Password for "Mail"
4. Use that as `SMTP_PASS`

### 3. Start development servers

```bash
npm run dev
```

This starts:
- Frontend at http://localhost:5173
- Backend at http://localhost:3001

## Production Build

```bash
npm run build
```

Serve the built client from `client/dist/` via a static file server or CDN.
Start the backend with `cd server && npm start`.

## Camera Requirements

The camera scanning feature requires:
- **HTTPS** in production (required by browsers for camera access)
- Camera permissions granted by the user
- A physical camera (back camera preferred on mobile)

## Environment Variables Reference

| Variable          | Required | Description                                          |
|-------------------|----------|------------------------------------------------------|
| `OPENAI_API_KEY`  | Yes      | OpenAI API key with gpt-4o access                   |
| `SMTP_HOST`       | Yes      | SMTP server hostname                                 |
| `SMTP_PORT`       | Yes      | SMTP port (587 for STARTTLS, 465 for SSL)            |
| `SMTP_SECURE`     | Yes      | `true` for SSL (port 465), `false` for STARTTLS     |
| `SMTP_USER`       | Yes      | SMTP authentication username                         |
| `SMTP_PASS`       | Yes      | SMTP authentication password / app password         |
| `SMTP_FROM_NAME`  | No       | Display name for the sender (default: Immigration Portal) |
| `SMTP_FROM`       | Yes      | Sender email address                                 |
| `AGENCY_EMAIL`    | Yes      | Destination email for all intake submissions        |
| `CLIENT_URL`      | No       | Frontend URL for CORS (default: http://localhost:5173) |
| `PORT`            | No       | Server port (default: 3001)                          |

## API Endpoints

| Method | Path              | Description                              |
|--------|-------------------|------------------------------------------|
| GET    | /api/health       | Health check                             |
| POST   | /api/validate-scan | Validates document type via AI           |
| POST   | /api/extract-data  | Extracts fields from scanned pages (OCR) |
| POST   | /api/submit        | Generates PDFs and sends email           |

## Security

- Images are held in browser memory only (no localStorage)
- Server processes images in-memory — nothing is written to disk
- PDFs are streamed directly to nodemailer without temp files
- All session data is discarded after email delivery
- CORS is restricted to the configured `CLIENT_URL`
- Use HTTPS in production

## Cost Estimate

Per submission (approximate):
- Document type validation: ~$0.002 per page (gpt-4o, low detail)
- OCR extraction: ~$0.01 per document (gpt-4o, high detail)
- Typical full submission (5 documents): ~$0.05–$0.15 USD

## Supported Documents

1. Passport
2. Visa
3. Driver's License
4. Educational Credential
5. Employment Letter
6. Financial Proof
7. Marriage Certificate
8. Birth Certificate
9. Supporting Documents
