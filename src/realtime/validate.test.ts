import { describe, it, expect } from 'vitest';
import {
  parseTypingPayload,
  parseCursorPayload,
  parsePresenceEntry,
  parseTypingStopPayload,
  MAX_NICKNAME,
  MAX_TYPING_TEXT,
  MAX_OFFSET,
} from './validate';

// Realtime broadcast/presence channels are open to anyone holding the anon
// key, so every payload is attacker-controlled. These parsers are the only
// thing between the wire and the renderer.

const uid = '11111111-1111-1111-1111-111111111111';

describe('parseTypingPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(parseTypingPayload({ userId: uid, nickname: 'luna', text: 'hola', t: 0.5, ox: 1, oy: -1 }))
      .toEqual({ userId: uid, nickname: 'luna', text: 'hola', t: 0.5, ox: 1, oy: -1 });
  });

  it('rejects non-objects and payloads without a string userId', () => {
    expect(parseTypingPayload(null)).toBeNull();
    expect(parseTypingPayload('x')).toBeNull();
    expect(parseTypingPayload({})).toBeNull();
    expect(parseTypingPayload({ userId: 42 })).toBeNull();
    expect(parseTypingPayload({ userId: '' })).toBeNull();
    expect(parseTypingPayload({ userId: 'a'.repeat(200) })).toBeNull();
  });

  it('bounds nickname and text length so canvases stay small', () => {
    const p = parseTypingPayload({ userId: uid, nickname: 'n'.repeat(5000), text: 't'.repeat(5000) })!;
    expect(p.nickname).toHaveLength(MAX_NICKNAME);
    expect(p.text).toHaveLength(MAX_TYPING_TEXT);
  });

  it('defaults nickname and text when missing or not strings', () => {
    const p = parseTypingPayload({ userId: uid, nickname: { evil: 1 }, text: 123 })!;
    expect(p.nickname).toBe('anon');
    expect(p.text).toBe('');
  });

  it('strips control characters and collapses whitespace-only nicknames', () => {
    expect(parseTypingPayload({ userId: uid, nickname: ' ab\n' })!.nickname).toBe('ab');
    expect(parseTypingPayload({ userId: uid, nickname: '   ' })!.nickname).toBe('anon');
  });

  it('clamps geometry and replaces non-finite numbers', () => {
    const p = parseTypingPayload({ userId: uid, t: 7, ox: -1e9, oy: Number.NaN })!;
    expect(p.t).toBe(1);
    expect(p.ox).toBe(-MAX_OFFSET);
    expect(p.oy).toBe(0);
    expect(parseTypingPayload({ userId: uid, t: '0.5', ox: Infinity, oy: null })!)
      .toMatchObject({ t: 0, ox: 0, oy: 0 });
  });
});

describe('parseTypingStopPayload', () => {
  it('returns the userId only when it is a plausible string', () => {
    expect(parseTypingStopPayload({ userId: uid })).toBe(uid);
    expect(parseTypingStopPayload({ userId: 1 })).toBeNull();
    expect(parseTypingStopPayload(undefined)).toBeNull();
  });
});

describe('parseCursorPayload', () => {
  it('accepts and clamps a cursor position', () => {
    expect(parseCursorPayload({ userId: uid, t: -3, ox: 2, oy: 99 }))
      .toEqual({ userId: uid, t: 0, ox: 2, oy: MAX_OFFSET });
  });

  it('rejects payloads without a userId', () => {
    expect(parseCursorPayload({ t: 0.5 })).toBeNull();
  });
});

describe('parsePresenceEntry', () => {
  it('accepts nickname and a hsl/hex color', () => {
    expect(parsePresenceEntry({ nickname: 'río', color: 'hsl(120, 70%, 70%)' }))
      .toEqual({ nickname: 'río', color: 'hsl(120, 70%, 70%)' });
    expect(parsePresenceEntry({ nickname: 'río', color: '#a1B2c3' }).color).toBe('#a1B2c3');
  });

  it('falls back to white for anything that is not a simple color literal', () => {
    expect(parsePresenceEntry({ color: 'url(javascript:alert(1))' }).color).toBe('#ffffff');
    expect(parsePresenceEntry({ color: 'red; background: url(x)' }).color).toBe('#ffffff');
    expect(parsePresenceEntry({ color: 12 }).color).toBe('#ffffff');
    expect(parsePresenceEntry(null).color).toBe('#ffffff');
  });

  it('bounds the nickname', () => {
    expect(parsePresenceEntry({ nickname: 'x'.repeat(100) }).nickname).toHaveLength(MAX_NICKNAME);
    expect(parsePresenceEntry({}).nickname).toBe('anon');
  });
});
