import { initScene, rebuildTubeMeshes } from './tunnel/scene';
import { initCameraControls } from './tunnel/camera';
import { initParallax } from './tunnel/parallax';
import { startLoop, onFrame } from './tunnel/loop';
import { state } from './state';
import { bus } from './events';
import { syncThoughtsToScene, updateThoughts, addThought, ensureFontReady } from './thoughts/renderer';
import { initComposer } from './input/composer';
import { getNickname } from './input/nickname';
import { showOnboarding } from './ui/onboarding';
import { initMenu } from './ui/menu';
import { initSupabase } from './realtime/client';
import { initThoughtsSync, submitThought } from './realtime/thoughts-sync';
import { initPresence, pruneStale } from './realtime/presence';
import { initLiveTyping, pruneStaleTyping } from './realtime/live-typing';
import { updateCursors } from './ui/cursor-renderer';
import { updateTypingIndicators } from './ui/typing-indicator';
import { markThoughtPosted } from './input/rate-limit';
import { rebuildCurve } from './tunnel/curve';
import { initMobileTouchpad, updateTouchpadIndicator } from './ui/mobile-touchpad';
import { seedThoughts } from './dev/seed-thoughts';
import type { Thought, ThoughtSubmission } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// -- Init scene --
const canvas = document.getElementById('tunnel') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLDivElement;
initScene(canvas);
initCameraControls(canvas);
initParallax(canvas);

let supabaseClient: SupabaseClient | null = null;

function maybeExtendTunnel(): void {
  const count = state.thoughts.size;
  if (rebuildCurve(count)) {
    rebuildTubeMeshes();
  }
}

// -- Boot sequence --
async function boot(): Promise<void> {
  state.targetT = 0.001;
  startLoop();

  await ensureFontReady();

  supabaseClient = await initSupabase();

  // Load nickname from localStorage before presence tracks it
  state.nickname = getNickname();

  if (supabaseClient) {
    await initThoughtsSync(supabaseClient);
    initPresence(supabaseClient);
    initLiveTyping(supabaseClient);
  } else {
    for (const t of seedThoughts) {
      state.thoughts.set(t.id, t);
    }
    syncThoughtsToScene();
  }

  maybeExtendTunnel();

  // Onboarding
  await showOnboarding(uiRoot);

  // Enable interaction
  await new Promise(r => setTimeout(r, 300));
  initComposer(canvas, uiRoot);
  initMenu(uiRoot);
  initMobileTouchpad(uiRoot);
}

// -- Handle thought submissions --
bus.on('thought:submitted', async (submission: ThoughtSubmission) => {
  if (!submission) return;

  if (supabaseClient) {
    const thought = await submitThought(supabaseClient, submission);
    if (thought) {
      markThoughtPosted();
      maybeExtendTunnel();
    }
  } else {
    const thought: Thought = {
      id: crypto.randomUUID(),
      body: submission.body,
      nickname: submission.nickname,
      authorId: 'local',
      t: submission.t,
      ox: submission.ox,
      oy: submission.oy,
      createdAt: new Date().toISOString(),
    };
    state.thoughts.set(thought.id, thought);
    addThought(thought);
    maybeExtendTunnel();
  }
});

// Extend tunnel when new thoughts arrive from realtime
bus.on('thought:added', () => {
  maybeExtendTunnel();
});

// -- Frame loop --
onFrame((_dt) => {
  updateThoughts();
  updateCursors();
  updateTypingIndicators();
  updateTouchpadIndicator();
  pruneStale();
  pruneStaleTyping();
});

boot();
