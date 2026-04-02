import * as THREE from 'three';
import { state } from '../state';
import { bus } from '../events';
import { canThinkToday, markThoughtPosted } from './rate-limit';
import { getNickname } from './nickname';
import { camera, tubeMesh } from '../tunnel/scene';
import { getCurveFrame, worldToParam, getCurvePoint } from '../tunnel/curve';
import { TUBE_RADIUS } from '../tunnel/tube';
import { t } from '../i18n';
import { findClearPosition } from '../thoughts/collision';
import { broadcastTyping, broadcastTypingStop } from '../realtime/live-typing';
import type { ThoughtSubmission } from '../types';

let overlay: HTMLDivElement | null = null;
let textarea: HTMLTextAreaElement | null = null;
let charCount: HTMLSpanElement | null = null;
let submitBtn: HTMLButtonElement | null = null;

const MAX_CHARS = 200;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function initComposer(canvas: HTMLCanvasElement, uiRoot: HTMLElement): void {
  canvas.addEventListener('click', (e) => {
    if (state.composerOpen) return;
    if (!canThinkToday()) {
      showRateLimitMessage(uiRoot);
      return;
    }
    openComposer(e.clientX, e.clientY, canvas, uiRoot);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.composerOpen) {
      closeComposer();
    }
  });
}

function clickToTunnelPos(clickX: number, clickY: number, canvas: HTMLCanvasElement): { t: number; ox: number; oy: number } {
  // Raycast from camera through click point to tube wall
  mouse.x = (clickX / canvas.clientWidth) * 2 - 1;
  mouse.y = -(clickY / canvas.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(tubeMesh);

  if (intersects.length > 0) {
    const hit = intersects[0].point;
    const param = worldToParam(hit);
    const frame = getCurveFrame(param);
    const curvePos = getCurvePoint(param);

    // Project offset from curve center onto frame vectors
    const offset = hit.clone().sub(curvePos);
    let ox = offset.dot(frame.normal);
    let oy = offset.dot(frame.binormal);

    // Clamp radius so text stays well inside the tunnel wall
    const maxR = TUBE_RADIUS * 0.6;
    const r = Math.sqrt(ox * ox + oy * oy);
    if (r > maxR) {
      const scale = maxR / r;
      ox *= scale;
      oy *= scale;
    }

    return { t: param, ox, oy };
  }

  // Fallback: place ahead of camera with screen-based offset
  const param = Math.min(state.cameraT + 0.02 + Math.random() * 0.015, 0.94);
  const ndx = (clickX / window.innerWidth) * 2 - 1;
  const ndy = -(clickY / window.innerHeight) * 2 + 1;
  return {
    t: param,
    ox: ndx * TUBE_RADIUS * 0.35,
    oy: ndy * TUBE_RADIUS * 0.3,
  };
}

function openComposer(clickX: number, clickY: number, canvas: HTMLCanvasElement, uiRoot: HTMLElement): void {
  const pos = clickToTunnelPos(clickX, clickY, canvas);

  state.composerOpen = true;
  state.composerT = pos.t;
  state.composerOx = pos.ox;
  state.composerOy = pos.oy;

  overlay = document.createElement('div');
  overlay.className = 'composer-overlay';

  const left = Math.min(clickX, window.innerWidth - 320);
  const top = Math.min(clickY, window.innerHeight - 200);
  overlay.style.left = left + 'px';
  overlay.style.top = top + 'px';

  const card = document.createElement('div');
  card.className = 'composer-card';

  textarea = document.createElement('textarea');
  textarea.placeholder = t('composer.placeholder');
  textarea.maxLength = MAX_CHARS;
  textarea.addEventListener('input', onInput);

  const footer = document.createElement('div');
  footer.className = 'composer-footer';

  charCount = document.createElement('span');
  charCount.className = 'composer-charcount';
  charCount.textContent = `0/${MAX_CHARS}`;

  submitBtn = document.createElement('button');
  submitBtn.className = 'composer-submit';
  submitBtn.textContent = t('composer.submit');
  submitBtn.disabled = true;
  submitBtn.addEventListener('click', onSubmit);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'composer-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', closeComposer);

  footer.appendChild(charCount);
  footer.appendChild(submitBtn);
  card.appendChild(closeBtn);
  card.appendChild(textarea);
  card.appendChild(footer);
  overlay.appendChild(card);
  uiRoot.appendChild(overlay);

  textarea.addEventListener('wheel', (e) => e.stopPropagation());
  setTimeout(() => textarea?.focus(), 50);
}

function onInput(): void {
  if (!textarea || !charCount || !submitBtn) return;
  const len = textarea.value.length;
  charCount.textContent = `${len}/${MAX_CHARS}`;
  submitBtn.disabled = len === 0 || len > MAX_CHARS;

  // Broadcast typing to other users
  if (len > 0) {
    broadcastTyping(textarea.value, state.composerT, state.composerOx, state.composerOy);
  } else {
    broadcastTypingStop();
  }
}

function onSubmit(): void {
  if (!textarea) return;
  const body = textarea.value.trim();
  if (!body || body.length > MAX_CHARS) return;

  const nickname = getNickname() || 'anon';

  // Feature 2: collision-aware placement
  const cleared = findClearPosition(state.composerT, state.composerOx, state.composerOy, body);

  const submission: ThoughtSubmission = {
    body,
    nickname,
    t: cleared.t,
    ox: cleared.ox,
    oy: cleared.oy,
  };

  bus.emit('thought:submitted', submission);
  markThoughtPosted();
  closeComposer();
}

function closeComposer(): void {
  broadcastTypingStop();
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  textarea = null;
  charCount = null;
  submitBtn = null;
  state.composerOpen = false;
}

function showRateLimitMessage(uiRoot: HTMLElement): void {
  const existing = uiRoot.querySelector('.rate-limit-msg');
  if (existing) return;

  const msg = document.createElement('div');
  msg.className = 'rate-limit-msg';
  msg.textContent = t('rate_limit.message');
  uiRoot.appendChild(msg);

  setTimeout(() => msg.remove(), 3000);
}
