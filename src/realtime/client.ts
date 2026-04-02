import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { state } from '../state';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  return supabase;
}

export async function initSupabase(): Promise<SupabaseClient | null> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('Supabase not configured — running in local-only mode');
    return null;
  }

  supabase = createClient(url, key);

  // Sign in anonymously
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn('Anonymous auth failed:', error.message);
      return null;
    }
    state.userId = data.user?.id ?? null;
  } else {
    state.userId = session.user.id;
  }

  return supabase;
}
