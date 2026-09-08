// Parsers for data arriving over Supabase Realtime.
//
// Broadcast and presence channels are open to anyone holding the public anon
// key, so nothing in these payloads can be trusted: types, lengths, numeric
// ranges and identities are all attacker-controlled. Everything that reaches
// the renderer goes through here first. The DB layer has matching constraints
// (see supabase/migrations/003_harden_security.sql).

export const MAX_NICKNAME = 20;       // matches the DB check on thoughts.nickname
export const MAX_TYPING_TEXT = 50;    // live-typing preview length
export const MAX_OFFSET = 4;          // TUBE_RADIUS in src/tunnel/tube.ts
const MAX_USER_ID = 64;               // Supabase user ids are 36-char UUIDs

const DEFAULT_NICKNAME = 'anon';
const DEFAULT_COLOR = '#ffffff';
const COLOR_RE = /^(#[0-9a-fA-F]{6}|hsl\(\d{1,3}, \d{1,3}%, \d{1,3}%\))$/;
// C0 / C1 controls plus line and paragraph separators.
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

export interface TypingPayload {
  userId: string;
  nickname: string;
  text: string;
  t: number;
  ox: number;
  oy: number;
}

export interface CursorPayload {
  userId: string;
  t: number;
  ox: number;
  oy: number;
}

export interface PresenceEntry {
  nickname: string;
  color: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function userId(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_USER_ID) return null;
  return v;
}

function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(CONTROL_RE, '').trim().slice(0, max);
}

function nickname(v: unknown): string {
  return cleanText(v, MAX_NICKNAME) || DEFAULT_NICKNAME;
}

function clamp(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.min(max, Math.max(min, v));
}

function color(v: unknown): string {
  return typeof v === 'string' && COLOR_RE.test(v) ? v : DEFAULT_COLOR;
}

export function parseTypingPayload(raw: unknown): TypingPayload | null {
  if (!isRecord(raw)) return null;
  const id = userId(raw.userId);
  if (!id) return null;
  return {
    userId: id,
    nickname: nickname(raw.nickname),
    text: cleanText(raw.text, MAX_TYPING_TEXT),
    t: clamp(raw.t, 0, 1),
    ox: clamp(raw.ox, -MAX_OFFSET, MAX_OFFSET),
    oy: clamp(raw.oy, -MAX_OFFSET, MAX_OFFSET),
  };
}

export function parseTypingStopPayload(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  return userId(raw.userId);
}

export function parseCursorPayload(raw: unknown): CursorPayload | null {
  if (!isRecord(raw)) return null;
  const id = userId(raw.userId);
  if (!id) return null;
  return {
    userId: id,
    t: clamp(raw.t, 0, 1),
    ox: clamp(raw.ox, -MAX_OFFSET, MAX_OFFSET),
    oy: clamp(raw.oy, -MAX_OFFSET, MAX_OFFSET),
  };
}

export function parsePresenceEntry(raw: unknown): PresenceEntry {
  if (!isRecord(raw)) return { nickname: DEFAULT_NICKNAME, color: DEFAULT_COLOR };
  return { nickname: nickname(raw.nickname), color: color(raw.color) };
}
