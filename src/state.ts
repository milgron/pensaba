import type { Thought, CursorState, TypingState } from './types';

export const state = {
  // Camera
  cameraT: 0,
  targetT: 0,
  mouseX: 0,   // normalized -1 to 1 (for parallax)
  mouseY: 0,
  mousePixelX: 0, // raw pixel position (for repulsion)
  mousePixelY: 0,

  // Identity
  userId: null as string | null,
  nickname: null as string | null,
  isOnboarded: false,
  audioEnabled: false,

  // Data
  thoughts: new Map<string, Thought>(),
  cursors: new Map<string, CursorState>(),
  typingUsers: new Map<string, TypingState>(),

  // UI state
  composerOpen: false,
  composerT: 0,
  composerOx: 0,
  composerOy: 0,
};
