import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { state } from '../state';
import { bus } from '../events';
import type { CursorState } from '../types';

let channel: RealtimeChannel | null = null;
let presenceInterval: ReturnType<typeof setInterval> | null = null;
let cursorInterval: ReturnType<typeof setInterval> | null = null;

const PRESENCE_INTERVAL = 30000; // 30s — low-frequency online status
const CURSOR_BROADCAST_INTERVAL = 200; // 200ms — high-frequency cursor position
const STALE_TIMEOUT = 10000;

export function initPresence(supabase: SupabaseClient): void {
  if (!state.userId) {
    console.warn('[presence] No userId, skipping presence init');
    return;
  }

  const color = getOrCreateColor();
  const cursorOffset = getOrCreateCursorOffset();

  channel = supabase.channel('cursors', {
    config: { presence: { key: state.userId } },
  });

  // --- Presence: online status (low frequency) ---
  channel.on('presence', { event: 'sync' }, () => {
    const presenceState = channel!.presenceState();
    const now = Date.now();

    // Add new users from presence, preserve position from broadcast
    for (const [key, entries] of Object.entries(presenceState)) {
      if (key === state.userId) continue;
      const entry = (entries as any[])[0];
      if (!entry) continue;

      const existing = state.cursors.get(key);
      if (existing) {
        // Update online info but keep position from broadcast
        existing.nickname = entry.nickname || 'anon';
        existing.color = entry.color || '#ffffff';
        existing.lastSeen = now;
      } else {
        // New user — create entry
        state.cursors.set(key, {
          userId: key,
          nickname: entry.nickname || 'anon',
          t: 0,
          ox: 0,
          oy: 0,
          color: entry.color || '#ffffff',
          lastSeen: now,
        });
      }
    }

    // Remove users that left presence
    for (const key of state.cursors.keys()) {
      if (!presenceState[key]) {
        state.cursors.delete(key);
      }
    }

    bus.emit('cursor:updated', undefined);
  });

  // --- Broadcast: cursor position (high frequency) ---
  channel.on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
    if (!payload || payload.userId === state.userId) return;

    const existing = state.cursors.get(payload.userId);
    if (existing) {
      existing.t = payload.t ?? existing.t;
      existing.ox = payload.ox ?? existing.ox;
      existing.oy = payload.oy ?? existing.oy;
      existing.lastSeen = Date.now();
    }
  });

  channel.subscribe(async (status, err) => {
    if (status === 'SUBSCRIBED') {
      console.log('[presence] channel subscribed');
      // Track presence (online status only)
      await channel!.track({
        nickname: state.nickname || 'anon',
        color,
      });
    } else {
      console.log('[presence] channel status:', status, err);
    }
  });

  // Re-track presence every 30s (keep-alive)
  presenceInterval = setInterval(() => {
    if (!channel) return;
    channel.track({
      nickname: state.nickname || 'anon',
      color,
    });
  }, PRESENCE_INTERVAL);

  // Broadcast cursor position at ~5fps
  cursorInterval = setInterval(() => {
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'cursor_move',
      payload: {
        userId: state.userId,
        t: state.cameraT,
        ox: cursorOffset.ox,
        oy: cursorOffset.oy,
      },
    });
  }, CURSOR_BROADCAST_INTERVAL);
}

export function cleanupPresence(): void {
  if (presenceInterval) clearInterval(presenceInterval);
  if (cursorInterval) clearInterval(cursorInterval);
  channel?.unsubscribe();
}

// Prune stale cursors
export function pruneStale(): void {
  const now = Date.now();
  for (const [key, cursor] of state.cursors) {
    if (now - cursor.lastSeen > STALE_TIMEOUT) {
      state.cursors.delete(key);
    }
  }
}

function getOrCreateCursorOffset(): { ox: number; oy: number } {
  const LS_OFFSET = 'pensaba:cursor_offset';
  const stored = localStorage.getItem(LS_OFFSET);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* regenerate */ }
  }
  // Random angle, radius between 0.3 and 0.8 of tube radius (~1.2 to 3.2)
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.3 + Math.random() * 0.5;
  const offset = {
    ox: Math.cos(angle) * radius * 4, // TUBE_RADIUS = 4
    oy: Math.sin(angle) * radius * 4,
  };
  localStorage.setItem(LS_OFFSET, JSON.stringify(offset));
  return offset;
}

function getOrCreateColor(): string {
  const LS_COLOR = 'pensaba:color';
  let color = localStorage.getItem(LS_COLOR);
  if (!color) {
    const hue = Math.floor(Math.random() * 360);
    color = `hsl(${hue}, 70%, 70%)`;
    localStorage.setItem(LS_COLOR, color);
  }
  return color;
}
