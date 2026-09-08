import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { state } from '../state';
import { bus } from '../events';
import type { TypingState } from '../types';
import { parseTypingPayload, parseTypingStopPayload } from './validate';

let channel: RealtimeChannel | null = null;
const THROTTLE_MS = 200;
const STALE_TIMEOUT = 3000;

let lastBroadcast = 0;

export function initLiveTyping(supabase: SupabaseClient): void {
  if (!state.userId) return;

  channel = supabase.channel('typing');

  channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
    const parsed = parseTypingPayload(payload);
    if (!parsed || parsed.userId === state.userId) return;

    const typing: TypingState = { ...parsed, lastUpdate: Date.now() };
    state.typingUsers.set(typing.userId, typing);
    bus.emit('typing:updated', undefined);
  });

  channel.on('broadcast', { event: 'typing_stop' }, ({ payload }) => {
    const userId = parseTypingStopPayload(payload);
    if (!userId) return;
    state.typingUsers.delete(userId);
    bus.emit('typing:updated', undefined);
  });

  channel.subscribe();
}

export function broadcastTyping(text: string, t: number, ox: number, oy: number): void {
  if (!channel || !state.userId) return;

  const now = Date.now();
  if (now - lastBroadcast < THROTTLE_MS) return;
  lastBroadcast = now;

  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: {
      userId: state.userId,
      nickname: state.nickname || 'anon',
      text: text.slice(0, 50),
      t,
      ox,
      oy,
    },
  });
}

export function broadcastTypingStop(): void {
  if (!channel || !state.userId) return;
  channel.send({
    type: 'broadcast',
    event: 'typing_stop',
    payload: { userId: state.userId },
  });
}

export function pruneStaleTyping(): void {
  const now = Date.now();
  for (const [key, typing] of state.typingUsers) {
    if (now - typing.lastUpdate > STALE_TIMEOUT) {
      state.typingUsers.delete(key);
    }
  }
}

export function cleanupLiveTyping(): void {
  channel?.unsubscribe();
}
