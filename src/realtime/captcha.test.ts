import { describe, it, expect, vi } from 'vitest';
import { requestCaptchaToken, type TurnstileApi, type TurnstileOptions } from './captcha';

// The Turnstile API is injected so these tests run without a DOM or network.

function fakeApi(drive: (opts: TurnstileOptions) => void) {
  const removed: string[] = [];
  const api: TurnstileApi = {
    render: (_el, opts) => { queueMicrotask(() => drive(opts)); return 'widget-1'; },
    remove: (id) => { removed.push(id); },
  };
  return { api, removed };
}

const el = {} as HTMLElement;

describe('requestCaptchaToken', () => {
  it('resolves with the token from the callback and removes the widget', async () => {
    const { api, removed } = fakeApi((o) => o.callback('tok-123'));
    await expect(requestCaptchaToken(api, el, 'site-key')).resolves.toBe('tok-123');
    expect(removed).toEqual(['widget-1']);
  });

  it('passes the site key to the widget', async () => {
    let seen: TurnstileOptions | undefined;
    const { api } = fakeApi((o) => { seen = o; o.callback('t'); });
    await requestCaptchaToken(api, el, 'site-key');
    expect(seen?.sitekey).toBe('site-key');
  });

  it('rejects when Turnstile reports an error', async () => {
    const { api, removed } = fakeApi((o) => o['error-callback']('300030'));
    await expect(requestCaptchaToken(api, el, 'k')).rejects.toThrow(/300030/);
    expect(removed).toEqual(['widget-1']);
  });

  it('rejects when the challenge is never solved within the timeout', async () => {
    vi.useFakeTimers();
    const { api } = fakeApi(() => { /* user never solves it */ });
    const p = requestCaptchaToken(api, el, 'k', 1000);
    const assertion = expect(p).rejects.toThrow(/timeout/);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    vi.useRealTimers();
  });
});
