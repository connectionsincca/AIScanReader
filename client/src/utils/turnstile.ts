/**
 * Cloudflare Turnstile helper — invisible human-verification widget.
 *
 * Development:
 *   VITE_TURNSTILE_SITE_KEY is unset → falls back to the Cloudflare test site
 *   key (1x00000000000000000000AA) which always passes without a real widget.
 *
 * Production:
 *   Set VITE_TURNSTILE_SITE_KEY in your Railway / hosting env vars to the real
 *   site key from the Cloudflare Turnstile dashboard.
 */

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          size?: 'normal' | 'compact' | 'invisible';
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
    };
  }
}

const SITE_KEY =
  (import.meta as { env?: Record<string, string> }).env
    ?.VITE_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';

/**
 * Renders an invisible Turnstile widget at the bottom of the page, waits for
 * the challenge to complete, and resolves with the one-time token.
 * The widget and its container are removed from the DOM after use.
 */
export function verifyHuman(): Promise<string> {
  return new Promise((resolve, reject) => {
    // If the Turnstile script hasn't loaded (e.g. no internet, or dev without
    // the script tag), fall through with a dev-bypass token — the server-side
    // session route skips verification for the Cloudflare test secret key.
    if (typeof window.turnstile === 'undefined') {
      resolve('dev-bypass');
      return;
    }

    const container = document.createElement('div');
    container.style.cssText =
      'position:fixed;bottom:0;left:0;z-index:9999;opacity:0;pointer-events:none';
    document.body.appendChild(container);

    let widgetId: string;

    const cleanup = () => {
      try {
        if (widgetId) window.turnstile?.remove(widgetId);
      } catch {
        // ignore
      }
      container.remove();
    };

    widgetId = window.turnstile.render(container, {
      sitekey: SITE_KEY,
      size: 'invisible',
      callback: (token: string) => {
        cleanup();
        resolve(token);
      },
      'error-callback': () => {
        cleanup();
        reject(new Error('Human verification failed. Please try again.'));
      },
      'expired-callback': () => {
        cleanup();
        reject(new Error('Verification expired. Please try again.'));
      },
    });
  });
}
