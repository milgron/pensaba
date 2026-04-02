import * as THREE from 'three';
import { scene } from '../tunnel/scene';
import { state } from '../state';
import { thoughtWorldPos } from '../thoughts/placement';
import type { CursorState } from '../types';

interface CursorMesh {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  label: THREE.Sprite;
  labelMaterial: THREE.SpriteMaterial;
  labelTexture: THREE.CanvasTexture;
  targetPos: THREE.Vector3;
}

const cursors = new Map<string, CursorMesh>();
const PROXIMITY_THRESHOLD = 0.5;
const LERP_SPEED = 0.15;
const LABEL_OFFSET_Y = -0.12;

let dotTexture: THREE.CanvasTexture | null = null;

function getDotTexture(): THREE.CanvasTexture {
  if (dotTexture) return dotTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  dotTexture = new THREE.CanvasTexture(canvas);
  return dotTexture;
}

function createLabelTexture(nickname: string): { texture: THREE.CanvasTexture; width: number; height: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '300 22px Inter, system-ui, sans-serif';
  ctx.font = font;

  const metrics = ctx.measureText(nickname);
  const w = Math.ceil(metrics.width) + 16;
  const h = 32;

  canvas.width = w * 2;
  canvas.height = h * 2;
  ctx.scale(2, 2);
  ctx.font = font;
  ctx.fillStyle = 'rgba(224, 224, 224, 0.5)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nickname, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return { texture, width: w, height: h };
}

function createCursorMesh(cursor: CursorState): CursorMesh {
  const material = new THREE.SpriteMaterial({
    map: getDotTexture(),
    color: new THREE.Color(cursor.color),
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.15, 0.15, 1);

  const pos = thoughtWorldPos(cursor.t, cursor.ox, cursor.oy);
  sprite.position.copy(pos);
  scene.add(sprite);

  // Nickname label
  const { texture: labelTexture, width, height } = createLabelTexture(cursor.nickname);
  const labelMaterial = new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
  });
  const label = new THREE.Sprite(labelMaterial);
  const scale = 0.004;
  label.scale.set(width * scale, height * scale, 1);
  label.position.copy(pos);
  label.position.y += LABEL_OFFSET_Y;
  scene.add(label);

  return { sprite, material, label, labelMaterial, labelTexture, targetPos: pos };
}

export function updateCursors(): void {
  for (const [key, cursor] of state.cursors) {
    if (Math.abs(cursor.t - state.cameraT) > PROXIMITY_THRESHOLD) {
      const existing = cursors.get(key);
      if (existing) {
        scene.remove(existing.sprite);
        scene.remove(existing.label);
        existing.material.dispose();
        existing.labelMaterial.dispose();
        existing.labelTexture.dispose();
        cursors.delete(key);
      }
      continue;
    }

    let mesh = cursors.get(key);
    if (!mesh) {
      mesh = createCursorMesh(cursor);
      cursors.set(key, mesh);
    }

    mesh.targetPos = thoughtWorldPos(cursor.t, cursor.ox, cursor.oy);
    mesh.sprite.position.lerp(mesh.targetPos, LERP_SPEED);
    // Label follows dot
    const labelTarget = mesh.targetPos.clone();
    labelTarget.y += LABEL_OFFSET_Y;
    mesh.label.position.lerp(labelTarget, LERP_SPEED);
  }

  // Remove stale
  for (const [key, mesh] of cursors) {
    if (!state.cursors.has(key)) {
      scene.remove(mesh.sprite);
      scene.remove(mesh.label);
      mesh.material.dispose();
      mesh.labelMaterial.dispose();
      mesh.labelTexture.dispose();
      cursors.delete(key);
    }
  }
}
