import { Router } from 'express';
import { createSession } from '../services/sessionStore';

const router = Router();

/**
 * POST /api/session
 *
 * Body: { turnstileToken: string }
 *
 * Validates the Cloudflare Turnstile response token (if TURNSTILE_SECRET_KEY is
 * set to a real key), then issues a server-side session token the client must
 * include in the x-session-token header on every subsequent API call.
 *
 * Dev mode: if the env var is absent or set to the Cloudflare test key, the
 * Turnstile check is skipped so local development works without a real account.
 */
router.post('/session', async (req, res) => {
  const { turnstileToken } = req.body as { turnstileToken?: string };

  if (!turnstileToken) {
    res.status(400).json({ error: 'Missing verification token.' });
    return;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const isDevKey =
    !secretKey || secretKey === '1x0000000000000000000000000000000AA';

  if (!isDevKey) {
    try {
      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: secretKey, response: turnstileToken }),
        }
      );
      const result = (await verifyRes.json()) as {
        success: boolean;
        'error-codes'?: string[];
      };
      if (!result.success) {
        console.warn('[session] Turnstile rejected:', result['error-codes']);
        res.status(403).json({ error: 'Human verification failed. Please try again.' });
        return;
      }
    } catch (err) {
      // Fail open if Cloudflare is unreachable — do not block legitimate users
      console.error('[session] Turnstile verification network error (fail open):', err);
    }
  }

  const sessionToken = createSession();
  res.json({ sessionToken });
});

export default router;
