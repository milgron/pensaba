import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { state } from '../state';
import { bus } from '../events';
import { syncThoughtsToScene, addThought, removeThought } from '../thoughts/renderer';
import type { Thought, ThoughtSubmission } from '../types';

let channel: RealtimeChannel | null = null;

interface ThoughtRow {
  id: string;
  user_id: string;
  body: string;
  nickname: string;
  t: number;
  ox: number;
  oy: number;
  created_at: string;
  deleted_at: string | null;
}

function rowToThought(row: ThoughtRow): Thought {
  return {
    id: row.id,
    body: row.body,
    nickname: row.nickname,
    authorId: row.user_id,
    t: row.t,
    ox: row.ox,
    oy: row.oy,
    createdAt: row.created_at,
  };
}

export async function initThoughtsSync(supabase: SupabaseClient): Promise<void> {
  // Fetch existing thoughts
  const { data, error } = await supabase
    .from('thoughts')
    .select('*')
    .is('deleted_at', null)
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch thoughts:', error.message);
  } else if (data) {
    for (const row of data as ThoughtRow[]) {
      const thought = rowToThought(row);
      state.thoughts.set(thought.id, thought);
    }
    syncThoughtsToScene();
    bus.emit('thoughts:loaded', undefined);
  }

  // Subscribe to changes
  channel = supabase
    .channel('thoughts-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'thoughts' },
      (payload) => {
        const row = payload.new as ThoughtRow;
        if (row.deleted_at) return;
        const thought = rowToThought(row);
        if (!state.thoughts.has(thought.id)) {
          state.thoughts.set(thought.id, thought);
          addThought(thought);
          bus.emit('thought:added', thought);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'thoughts' },
      (payload) => {
        const row = payload.new as ThoughtRow;
        if (row.deleted_at) {
          state.thoughts.delete(row.id);
          removeThought(row.id);
          bus.emit('thought:removed', row.id);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] thoughts channel active');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[realtime] thoughts channel error:', err);
      } else {
        console.log('[realtime] thoughts channel:', status);
      }
    });
}

export async function submitThought(
  supabase: SupabaseClient,
  submission: ThoughtSubmission
): Promise<Thought | null> {
  const { data, error } = await supabase.rpc('insert_thought', {
    _body: submission.body,
    _nickname: submission.nickname,
    _t: submission.t,
    _ox: submission.ox,
    _oy: submission.oy,
  });

  if (error) {
    if (error.message.includes('already_posted_today')) {
      console.warn('Already posted today');
    } else {
      console.error('Failed to submit thought:', error.message);
    }
    return null;
  }

  // The INSERT subscription will pick it up, but also return it for immediate local use
  const id = data as string;
  const thought: Thought = {
    id,
    body: submission.body,
    nickname: submission.nickname,
    authorId: state.userId || 'unknown',
    t: submission.t,
    ox: submission.ox,
    oy: submission.oy,
    createdAt: new Date().toISOString(),
  };

  return thought;
}

export function cleanupThoughtsSync(): void {
  channel?.unsubscribe();
}
