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
import type { Thought, ThoughtSubmission } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// -- Init scene --
const canvas = document.getElementById('tunnel') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLDivElement;
initScene(canvas);
initCameraControls(canvas);
initParallax(canvas);

// -- Test thoughts (used when Supabase not configured) --
const testThoughts: Thought[] = [
  { id: '1', body: 'a veces pienso que el tiempo no pasa, sino que nos movemos nosotros', nickname: 'anon', authorId: '', t: 0.08, ox: 0.6, oy: 0.3, createdAt: '' },
  { id: '2', body: 'la mejor idea que tuve hoy se me ocurrió mientras esperaba el colectivo', nickname: 'luna', authorId: '', t: 0.18, ox: -0.7, oy: -0.2, createdAt: '' },
  { id: '3', body: 'hay algo hermoso en las cosas que no duran', nickname: 'río', authorId: '', t: 0.28, ox: 0.3, oy: 0.5, createdAt: '' },
  { id: '4', body: 'me pregunto cuántas personas están pensando lo mismo que yo ahora', nickname: 'nube', authorId: '', t: 0.38, ox: -0.5, oy: 0.1, createdAt: '' },
  { id: '5', body: 'el silencio también es una forma de decir algo', nickname: 'eco', authorId: '', t: 0.48, ox: 0.8, oy: -0.3, createdAt: '' },
  { id: '6', body: 'escribo esto sabiendo que mañana no va a existir', nickname: 'sombra', authorId: '', t: 0.56, ox: -0.4, oy: 0.4, createdAt: '' },
  { id: '7', body: 'las mejores conversaciones son las que tenés con vos mismo', nickname: 'faro', authorId: '', t: 0.65, ox: 0.6, oy: -0.2, createdAt: '' },
  { id: '8', body: 'si pudiera guardar un solo momento de hoy, sería este', nickname: 'brisa', authorId: '', t: 0.74, ox: -0.6, oy: 0.3, createdAt: '' },
  { id: '9', body: 'pensar es gratis pero cuesta todo', nickname: 'piedra', authorId: '', t: 0.82, ox: 0.4, oy: -0.4, createdAt: '' },
  { id: '10', body: 'lo que no se dice también ocupa espacio', nickname: 'humo', authorId: '', t: 0.90, ox: -0.5, oy: 0.1, createdAt: '' },
];

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
    for (const t of testThoughts) {
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

(window as any).__state = state;

boot();
