import { state } from '../state';
import { t } from '../i18n';

const SCROLL_SPEED = 0.0006;
const HINT_DURATION = 3000;

let touchpad: HTMLDivElement | null = null;
let indicator: HTMLDivElement | null = null;

export function initMobileTouchpad(uiRoot: HTMLElement): void {
  const isTouchDevice = 'ontouchstart' in window;

  touchpad = document.createElement('div');
  touchpad.className = 'mobile-touchpad';

  // Track indicator (shows current position in tunnel)
  indicator = document.createElement('div');
  indicator.className = 'touchpad-indicator';
  touchpad.appendChild(indicator);

  uiRoot.appendChild(touchpad);

  // Touch handling (mobile: primary scroll method)
  if (isTouchDevice) {
    let lastY = 0;
    let touching = false;

    touchpad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      lastY = e.touches[0].clientY;
      touching = true;
      touchpad!.classList.add('active');
      hideHint();
    }, { passive: false });

    touchpad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!touching) return;
      const dy = lastY - e.touches[0].clientY;
      lastY = e.touches[0].clientY;
      state.targetT += dy * SCROLL_SPEED;
      state.targetT = Math.max(0.001, Math.min(0.98, state.targetT));
    }, { passive: false });

    touchpad.addEventListener('touchend', () => {
      touching = false;
      touchpad!.classList.remove('active');
    });

    touchpad.addEventListener('touchcancel', () => {
      touching = false;
      touchpad!.classList.remove('active');
    });

    showHint();
  }

  // Mouse drag on desktop (optional scroll via trackbar)
  if (!isTouchDevice) {
    let dragging = false;
    let lastMouseY = 0;

    touchpad.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      lastMouseY = e.clientY;
      touchpad!.classList.add('active');
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dy = lastMouseY - e.clientY;
      lastMouseY = e.clientY;
      state.targetT += dy * SCROLL_SPEED;
      state.targetT = Math.max(0.001, Math.min(0.98, state.targetT));
    });

    window.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        touchpad!.classList.remove('active');
      }
    });
  }
}

export function updateTouchpadIndicator(): void {
  if (!indicator) return;
  const pct = (1 - state.cameraT) * 100;
  indicator.style.top = `${pct}%`;
}

let hintEl: HTMLDivElement | null = null;
let hintTimeout: ReturnType<typeof setTimeout> | null = null;

function showHint(): void {
  if (localStorage.getItem('pensaba:touchpad_hint') === 'seen') return;

  hintEl = document.createElement('div');
  hintEl.className = 'touchpad-hint';
  hintEl.innerHTML = `
    <div class="touchpad-hint-finger"></div>
    <div class="touchpad-hint-text">${t('touchpad.hint').replace('\n', '<br>')}</div>
  `;
  touchpad!.appendChild(hintEl);

  // Animate in
  requestAnimationFrame(() => hintEl?.classList.add('visible'));

  hintTimeout = setTimeout(() => {
    hideHint();
  }, HINT_DURATION);
}

function hideHint(): void {
  if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
  if (hintEl) {
    hintEl.classList.remove('visible');
    setTimeout(() => { hintEl?.remove(); hintEl = null; }, 400);
    localStorage.setItem('pensaba:touchpad_hint', 'seen');
  }
}
