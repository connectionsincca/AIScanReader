import nodemailer from 'nodemailer';
import { config } from '../config';
import type { FormData } from '../types';

const transporter = nodemailer.createTransport({
  host:   config.smtp.host,
  port:   config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
  // Always enforce TLS certificate validation — never skip in any environment.
  // If you use a self-signed cert in dev, add it to NODE_EXTRA_CA_CERTS instead.
  tls: { rejectUnauthorized: true },
});

/**
 * Escape a string for safe insertion into an HTML context.
 * Prevents a user-typed value like <script>alert(1)</script> from being
 * rendered as live HTML in the agency's email client.
 */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendSubmissionEmail(opts: {
  submissionId: string;
  formData: Partial<FormData>;
  documentsPdf: Buffer;
  formPdf: Buffer;
  submittedAt: Date;
}): Promise<void> {
  const { submissionId, formData, documentsPdf, formPdf, submittedAt } = opts;
  const name = esc(
    [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'Unknown Applicant'
  );

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #333; margin: 0; padding: 20px; }
  .header { background: #1e40af; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0; }
  .content { background: #f9fafb; padding: 20px 24px; border: 1px solid #e5e7eb; }
  .field  { margin-bottom: 10px; }
  .label  { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .value  { font-weight: bold; font-size: 15px; margin-top: 2px; }
  .footer { font-size: 12px; color: #9ca3af; margin-top: 20px; }
  .badge  { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
</style></head>
<body>
<div class="header">
  <h2 style="margin:0;font-size:20px;">New Immigration Intake Submission</h2>
  <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">Received ${submittedAt.toUTCString()}</p>
</div>
<div class="content">
  <p><span class="badge">New Submission</span></p>

  <div class="field"><div class="label">Applicant Name</div><div class="value">${name}</div></div>
  <div class="field"><div class="label">Submission ID</div><div class="value">${esc(submissionId)}</div></div>
  <div class="field"><div class="label">Submitted At</div><div class="value">${esc(submittedAt.toISOString().replace('T', ' ').slice(0, 19))} UTC</div></div>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">

  <p style="color:#374151;">Two PDF attachments are included with this email:</p>
  <ul style="color:#374151;padding-left:20px;">
    <li><strong>scanned_documents.pdf</strong> — all scanned identity documents</li>
    <li><strong>intake_form.pdf</strong> — completed immigration intake form</li>
  </ul>

  <p class="footer">
    This submission was generated automatically by the Immigration Intake Portal.<br>
    All temporary data has been deleted from the portal after this email was sent.
  </p>
</div>
</body>
</html>`;

  await transporter.sendMail({
    from:    `"${config.smtp.fromName}" <${config.smtp.from}>`,
    to:      config.agencyEmail,
    subject: `New Immigration Intake Submission — ${name} (${esc(submissionId).slice(0, 8).toUpperCase()})`,
    html:    bodyHtml,
    text:    `New Immigration Intake Submission\n\nApplicant: ${name}\nSubmission ID: ${submissionId}\nSubmitted: ${submittedAt.toISOString()}\n\nTwo PDFs are attached.`,
    attachments: [
      {
        filename:    'scanned_documents.pdf',
        content:     documentsPdf,
        contentType: 'application/pdf',
      },
      {
        filename:    'intake_form.pdf',
        content:     formPdf,
        contentType: 'application/pdf',
      },
    ],
  });
}
