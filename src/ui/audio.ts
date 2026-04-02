const LS_AUDIO = 'pensaba:audio';
const LS_VOLUME = 'pensaba:volume';
const LS_FREQ = 'pensaba:freq';

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let playing = false;

const DEFAULT_VOLUME = 0.15; // ~15% (normalized 0-1)
const MAX_VOLUME = 0.07;
const DEFAULT_FREQ = 0.40; // ~40% frequency (warmer than white)

function createWhiteNoiseBuffer(audioCtx: AudioContext): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const bufferSize = sampleRate * 3;
  const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function startWhiteNoise(): void {
  if (playing) return;

  if (!ctx) {
    ctx = new AudioContext();
  }

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const buffer = createWhiteNoiseBuffer(ctx);
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Lowpass filter for noise color control
  filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  setFrequency(getStoredFrequency());

  gain = ctx.createGain();
  const vol = getStoredVolume();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol * MAX_VOLUME, ctx.currentTime + 1);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  playing = true;

  localStorage.setItem(LS_AUDIO, 'on');
}

export function stopWhiteNoise(): void {
  if (!playing || !gain || !ctx) return;

  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  const src = source;
  setTimeout(() => {
    try { src?.stop(); } catch {}
  }, 600);

  source = null;
  playing = false;

  localStorage.setItem(LS_AUDIO, 'off');
}

export function setVolume(normalized: number): void {
  // normalized: 0 to 1
  const clamped = Math.max(0, Math.min(1, normalized));
  localStorage.setItem(LS_VOLUME, String(clamped));
  if (gain && ctx) {
    gain.gain.setTargetAtTime(clamped * MAX_VOLUME, ctx.currentTime, 0.05);
  }
}

export function getStoredVolume(): number {
  const stored = localStorage.getItem(LS_VOLUME);
  if (stored !== null) return parseFloat(stored);
  return DEFAULT_VOLUME;
}

export function setFrequency(normalized: number): void {
  // normalized: 0 (brown/deep) to 1 (white/full)
  const clamped = Math.max(0, Math.min(1, normalized));
  localStorage.setItem(LS_FREQ, String(clamped));

  if (filter && ctx) {
    // Map 0→200Hz (brown), 1→20000Hz (white)
    const minFreq = 200;
    const maxFreq = 20000;
    const freq = minFreq * Math.pow(maxFreq / minFreq, clamped);
    filter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  }
}

export function getStoredFrequency(): number {
  const stored = localStorage.getItem(LS_FREQ);
  if (stored !== null) return parseFloat(stored);
  return DEFAULT_FREQ;
}

export function isAudioEnabled(): boolean {
  return localStorage.getItem(LS_AUDIO) !== 'off';
}

export function isPlaying(): boolean {
  return playing;
}
