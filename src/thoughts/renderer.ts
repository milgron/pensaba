import * as THREE from 'three';
import { scene, camera } from '../tunnel/scene';
import { state } from '../state';
import { getCurvePoint } from '../tunnel/curve';
import { computeReveal } from './reveal';
import { createCurvedTextMesh, rerenderWithRepulsion, rerenderWithReveal, rerenderClean, type CurvedTextMesh } from './curved-text';
import { ensureFontReady } from './text-layout';
import type { Thought } from '../types';

interface ThoughtEntry {
  mesh: CurvedTextMesh | null;
  thought: Thought;
  loading: boolean;
  lastCharFraction: number;
}

const entries = new Map<string, ThoughtEntry>();
const SCREEN_REPULSION_RADIUS = 120;
const _v3 = new THREE.Vector3();

function projectToScreen(worldPos: THREE.Vector3): { x: number; y: number } | null {
  _v3.copy(worldPos).project(camera);
  if (_v3.z > 1) return null;
  return {
    x: (_v3.x * 0.5 + 0.5) * window.innerWidth,
    y: (-_v3.y * 0.5 + 0.5) * window.innerHeight,
  };
}

export function addThought(thought: Thought): void {
  if (entries.has(thought.id)) return;
  const entry: ThoughtEntry = { mesh: null, thought, loading: true, lastCharFraction: 0 };
  entries.set(thought.id, entry);

  createCurvedTextMesh(thought.body, thought.t, thought.ox, thought.oy, thought.nickname)
    .then((mesh) => {
      if (!entries.has(thought.id)) { mesh.dispose(); return; }
      entry.mesh = mesh;
      entry.loading = false;
      mesh.sprite.visible = false;
      scene.add(mesh.sprite);
    })
    .catch((err) => {
      console.warn('Failed to create curved text:', thought.id, err);
      entry.loading = false;
    });
}

export function removeThought(id: string): void {
  const entry = entries.get(id);
  if (!entry) return;
  if (entry.mesh) { scene.remove(entry.mesh.sprite); entry.mesh.dispose(); }
  entries.delete(id);
}

export function updateThoughts(): void {
  const camPos = getCurvePoint(state.cameraT);
  const mouseScreenX = state.mousePixelX;
  const mouseScreenY = state.mousePixelY;

  for (const [, entry] of entries) {
    if (!entry.mesh) continue;
    const mesh = entry.mesh;

    const dist = camPos.distanceTo(mesh.sprite.position);
    const reveal = computeReveal(dist);

    if (reveal.opacity <= 0) {
      mesh.sprite.visible = false;
      if (mesh.repulsionActive) rerenderClean(mesh, reveal.charFraction);
      continue;
    }

    mesh.sprite.visible = true;
    mesh.material.opacity = reveal.opacity;
    const s = reveal.scale;
    mesh.sprite.scale.set(mesh.baseScale.x * s, mesh.baseScale.y * s, 1);

    // Feature 1: Progressive reveal — re-render when charFraction changes
    const cf = reveal.charFraction;

    // Cursor repulsion check
    const screenPos = projectToScreen(mesh.sprite.position);
    if (!screenPos) {
      // Off screen — just update reveal
      if (cf !== entry.lastCharFraction || mesh.repulsionActive) {
        rerenderWithReveal(mesh, cf);
        entry.lastCharFraction = cf;
      }
      continue;
    }

    const sdx = mouseScreenX - screenPos.x;
    const sdy = mouseScreenY - screenPos.y;
    const sDist = Math.sqrt(sdx * sdx + sdy * sdy);
    const effectiveRadius = SCREEN_REPULSION_RADIUS * s;

    if (sDist < effectiveRadius * 2.5 && dist > 0.5) {
      // Repulsion active — project mouse to canvas coords
      const halfH = mesh.baseScale.y * s * 0.5;
      const topScreen = projectToScreen(
        mesh.sprite.position.clone().add(camera.up.clone().multiplyScalar(halfH))
      );
      const spriteScreenH = topScreen ? Math.abs(screenPos.y - topScreen.y) * 2 : 0;
      const spriteScreenW = spriteScreenH * (mesh.baseScale.x / mesh.baseScale.y);

      if (spriteScreenW > 1 && spriteScreenH > 1) {
        const canvasW = mesh.layout.canW;
        const canvasH = mesh.layout.canH;
        const mcx = ((mouseScreenX - screenPos.x) / spriteScreenW + 0.5) * canvasW;
        const mcy = ((mouseScreenY - screenPos.y) / spriteScreenH + 0.5) * canvasH;
        rerenderWithRepulsion(mesh, mcx, mcy, cf);
        entry.lastCharFraction = cf;
      }
    } else if (mesh.repulsionActive || cf !== entry.lastCharFraction) {
      // No repulsion — update reveal if needed
      rerenderClean(mesh, cf);
      entry.lastCharFraction = cf;
    }
  }
}

export function syncThoughtsToScene(): void {
  for (const [id, thought] of state.thoughts) {
    if (!entries.has(id)) addThought(thought);
  }
  for (const [id] of entries) {
    if (!state.thoughts.has(id)) removeThought(id);
  }
}

export function clearAllThoughts(): void {
  for (const [id] of entries) removeThought(id);
}

export { ensureFontReady };
