import { state } from '../state';
import { getCurveFrame } from './curve';
import { camera } from './scene';

const LERP_FACTOR = 0.05;
const SCROLL_SPEED = 0.0004;

export function initCameraControls(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.targetT += e.deltaY * SCROLL_SPEED;
    state.targetT = Math.max(0.001, Math.min(0.98, state.targetT));
  }, { passive: false });

  // Touch scroll on canvas — disabled on touch devices (use touchpad instead)
  const isTouchDevice = 'ontouchstart' in window;
  if (!isTouchDevice) {
    let lastTouchY = 0;
    canvas.addEventListener('touchstart', (e) => {
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const dy = lastTouchY - e.touches[0].clientY;
      lastTouchY = e.touches[0].clientY;
      state.targetT += dy * SCROLL_SPEED * 2;
      state.targetT = Math.max(0.001, Math.min(0.98, state.targetT));
    }, { passive: false });
  }
}

export function updateCamera(): void {
  state.cameraT += (state.targetT - state.cameraT) * LERP_FACTOR;

  const frame = getCurveFrame(state.cameraT);
  const lookT = Math.min(state.cameraT + 0.01, 0.999);
  const lookAt = getCurveFrame(lookT).position;

  camera.position.copy(frame.position);
  camera.up.copy(frame.binormal);
  camera.lookAt(lookAt);
}
