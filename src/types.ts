export interface Thought {
  id: string;
  body: string;
  nickname: string;
  authorId: string;
  t: number;
  ox: number;
  oy: number;
  createdAt: string;
}

export interface CursorState {
  userId: string;
  nickname: string;
  t: number;
  ox: number;
  oy: number;
  color: string;
  lastSeen: number;
}

export interface TypingState {
  userId: string;
  nickname: string;
  text: string;
  t: number;
  ox: number;
  oy: number;
  lastUpdate: number;
}

export interface ThoughtSubmission {
  body: string;
  nickname: string;
  t: number;
  ox: number;
  oy: number;
}

export interface EventMap {
  'thoughts:loaded': void;
  'thought:added': Thought;
  'thought:removed': string;
  'thought:submitted': ThoughtSubmission;
  'camera:moved': number;
  'cursor:updated': void;
  'typing:updated': void;
  'onboarding:complete': void;
}
