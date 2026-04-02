import * as THREE from 'three';
import { scene } from '../tunnel/scene';
import { state } from '../state';
import { thoughtWorldPos } from '../thoughts/placement';
import type { TypingState } from '../types';

interface TypingMesh {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  lastText: string;
}

const indicators = new Map<string, TypingMesh>();
const PROXIMITY = 0.5;
const WORLD_SCALE = 0.005;

const TYPING_FONT = '300 28px Inter, system-ui, sans-serif';
const NICK_FONT = '300 18px Inter, system-ui, sans-serif';
const TYPING_MAX_W = 600;
const TYPING_H = 72;

function renderTypingCanvas(canvas: HTMLCanvasElement | null, text: string, nickname: string): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = TYPING_MAX_W * 2;
    canvas.height = TYPING_H * 2;
  }

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(2, 2);

  // Typing text
  ctx.font = TYPING_FONT;
  ctx.fillStyle = 'rgba(224, 224, 224, 0.9)';
  ctx.textBaseline = 'top';
  ctx.fillText(text + '...', 10, 8);

  // Nickname
  ctx.font = NICK_FONT;
  ctx.fillStyle = 'rgba(224, 224, 224, 0.4)';
  ctx.fillText('— ' + nickname, 10, 44);

  ctx.restore();
  return canvas;
}

export function updateTypingIndicators(): void {
  for (const [key, typing] of state.typingUsers) {
    if (Math.abs(typing.t - state.cameraT) > PROXIMITY) {
      const existing = indicators.get(key);
      if (existing) {
        scene.remove(existing.sprite);
        existing.material.dispose();
        existing.texture.dispose();
        indicators.delete(key);
      }
      continue;
    }

    let mesh = indicators.get(key);
    if (!mesh) {
      const canvas = renderTypingCanvas(null, typing.text, typing.nickname);
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
      });

      const sprite = new THREE.Sprite(material);
      const sw = (canvas.width / 2) * WORLD_SCALE;
      const sh = (canvas.height / 2) * WORLD_SCALE;
      sprite.scale.set(sw, sh, 1);

      const pos = thoughtWorldPos(typing.t, typing.ox, typing.oy);
      sprite.position.copy(pos);
      scene.add(sprite);

      mesh = { sprite, material, texture, canvas, lastText: typing.text };
      indicators.set(key, mesh);
    } else if (mesh.lastText !== typing.text) {
      // Reuse canvas — just repaint and flag texture update
      renderTypingCanvas(mesh.canvas, typing.text, typing.nickname);
      mesh.texture.needsUpdate = true;
      mesh.lastText = typing.text;

      // Update position
      const pos = thoughtWorldPos(typing.t, typing.ox, typing.oy);
      mesh.sprite.position.copy(pos);
    }
  }

  // Remove stale
  for (const [key, mesh] of indicators) {
    if (!state.typingUsers.has(key)) {
      scene.remove(mesh.sprite);
      mesh.material.dispose();
      mesh.texture.dispose();
      indicators.delete(key);
    }
  }
}
