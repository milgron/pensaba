// Cloudflare Turnstile integration for anonymous sign-in.
//
// The one-thought-per-day quota is tied to an anonymous Supabase identity, so
// creating identities must cost something. Supabase verifies the Turnstile
// token server-side when "Captcha protection" is enabled; this module only
// obtains the token. The site key is public and bound to the domain.

export interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback': (code: string) => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  appearance?: 'always' | 'execute' | 'interaction-only';
}

export interface TurnstileApi {
  render(el: HTMLElement, opts: TurnstileOptions): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export const TURNSTILE_SITE_KEY: string =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAEsiFXDE7778OpBV';

const DEFAULT_TIMEOUT_MS = 90_000;

/** Renders a widget in `el` and resolves with the token once solved. */
export function requestCaptchaToken(
  api: TurnstileApi,
  el: HTMLElement,
  siteKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let widgetId: string | null = null;
    let done = false;

    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (widgetId !== null) api.remove(widgetId);
      fn();
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error('captcha timeout'))),
      timeoutMs,
    );

    widgetId = api.render(el, {
      sitekey: siteKey,
      theme: 'dark',
      appearance: 'interaction-only',
      callback: (token) => finish(() => resolve(token)),
      'error-callback': (code) => finish(() => reject(new Error(`captcha error ${code}`))),
      'expired-callback': () => finish(() => reject(new Error('captcha expired'))),
    });
  });
}

/** Waits for the Turnstile script (loaded async from index.html) to be ready. */
export async function waitForTurnstile(timeoutMs = 8_000): Promise<TurnstileApi | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.turnstile) return window.turnstile;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

/**
 * Full flow used by the client: mounts a slot in the UI, gets a token, and
 * cleans up. Returns undefined if Turnstile is unavailable so the caller can
 * still attempt sign-in (which Supabase will accept when captcha is off).
 */
export async function getCaptchaToken(uiRoot: HTMLElement): Promise<string | undefined> {
  const api = await waitForTurnstile();
  if (!api) {
    console.warn('[captcha] Turnstile not available, signing in without token');
    return undefined;
  }

  const slot = document.createElement('div');
  slot.className = 'captcha-slot';
  uiRoot.appendChild(slot);
  try {
    return await requestCaptchaToken(api, slot, TURNSTILE_SITE_KEY);
  } catch (e) {
    console.warn('[captcha]', (e as Error).message);
    return undefined;
  } finally {
    slot.remove();
  }
}
