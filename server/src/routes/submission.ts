import { Router } from 'express';
import type { Request, Response } from 'express';
import { generateDocumentsPdf, generateFormPdf } from '../services/pdfService';
import { sendSubmissionEmail } from '../services/emailService';
import type { SubmitRequest } from '../types';

const router = Router();

/**
 * In-memory deduplication store.
 * Tracks submissionIds that have already been successfully processed.
 * Entries expire after 24 hours so the Set doesn't grow unbounded across
 * a long-running server process.
 */
const submittedIds = new Map<string, number>(); // id → expiry timestamp
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, expiry] of submittedIds) {
    if (now > expiry) submittedIds.delete(id);
  }
}, 60 * 60 * 1000).unref();

// POST /api/submit
router.post('/submit', async (req: Request, res: Response) => {
  const { submissionId, formData, documents } = req.body as SubmitRequest;

  if (!submissionId || !formData || !Array.isArray(documents)) {
    return res.status(400).json({ success: false, message: 'Invalid submission payload.' });
  }

  // Reject duplicate submissions within 24 hours
  if (submittedIds.has(submissionId)) {
    return res.json({
      success: true,
      message: 'Your documents have been successfully submitted.',
    });
  }

  const submittedAt = new Date();

  try {
    // Generate both PDFs in parallel
    const [documentsPdf, formPdf] = await Promise.all([
      generateDocumentsPdf(documents),
      generateFormPdf(formData, submissionId, submittedAt),
    ]);

    // Send email
    await sendSubmissionEmail({ submissionId, formData, documentsPdf, formPdf, submittedAt });

    // Record as successfully submitted so duplicate retries are silently no-ops
    submittedIds.set(submissionId, Date.now() + DEDUP_TTL_MS);

    // We deliberately do NOT store anything else — PDFs are generated in-memory
    // and passed directly to nodemailer without touching disk.

    return res.json({
      success: true,
      message: 'Your documents have been successfully submitted.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/submit] error:', err);

    // Distinguish email errors from PDF errors
    const isEmail = msg.toLowerCase().includes('smtp') || msg.toLowerCase().includes('econnrefused');
    const userMsg = isEmail
      ? 'We could not send the email to the agency. Please retry in a few moments.'
      : 'An error occurred while preparing your submission. Please try again.';

    return res.status(500).json({ success: false, message: userMsg });
  }
});

export default router;
