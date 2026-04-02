import { state } from '../state';
import { getCurveFrame } from './curve';
import { camera } from './scene';

const PARALLAX_X = 1.5;
const PARALLAX_Y = 0.8;
const SMOOTH = 0.08;

let smoothX = 0;
let smoothY = 0;

export function initParallax(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('mousemove', (e) => {
    state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    state.mousePixelX = e.clientX;
    state.mousePixelY = e.clientY;
  });
}

export function applyParallax(): void {
  smoothX += (state.mouseX - smoothX) * SMOOTH;
  smoothY += (state.mouseY - smoothY) * SMOOTH;

  const frame = getCurveFrame(state.cameraT);
  camera.position.addScaledVector(frame.normal, smoothX * PARALLAX_X);
  camera.position.addScaledVector(frame.binormal, -smoothY * PARALLAX_Y);
}
