import { renderer, scene, camera } from './scene';
import { updateCamera } from './camera';
import { applyParallax } from './parallax';

type FrameCallback = (dt: number) => void;

const callbacks: FrameCallback[] = [];
let lastTime = 0;

export function onFrame(cb: FrameCallback): void {
  callbacks.push(cb);
}

export function startLoop(): void {
  lastTime = performance.now();
  tick(lastTime);
}

function tick(now: number): void {
  requestAnimationFrame(tick);

  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = now;

  updateCamera();
  applyParallax();

  for (const cb of callbacks) {
    cb(dt);
  }

  renderer.render(scene, camera);
}
