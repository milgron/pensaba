import { state } from '../state';
import { measureThoughtBounds } from './curved-text';

const WORLD_SCALE = 0.008;
const NUDGE_AMOUNT = 0.3;
const MAX_NUDGES = 3;
const T_PROXIMITY = 0.08;

interface BBox {
  t: number;
  ox: number;
  oy: number;
  halfW: number;
  halfH: number;
}

function boxesOverlap(a: BBox, b: BBox): boolean {
  if (Math.abs(a.t - b.t) > T_PROXIMITY) return false;
  return (
    Math.abs(a.ox - b.ox) < (a.halfW + b.halfW) &&
    Math.abs(a.oy - b.oy) < (a.halfH + b.halfH)
  );
}

export function findClearPosition(
  t: number,
  ox: number,
  oy: number,
  newText: string,
): { t: number; ox: number; oy: number } {
  const newBounds = measureThoughtBounds(newText);
  const newBox: BBox = {
    t, ox, oy,
    halfW: newBounds.width / 2,
    halfH: newBounds.height / 2,
  };

  // Build existing bounding boxes from state
  const existing: BBox[] = [];
  for (const [, thought] of state.thoughts) {
    if (Math.abs(thought.t - t) > T_PROXIMITY * 2) continue;
    // Estimate bounds from measurement (already stored on renderer entries)
    // Use approximate size since we don't have access to the mesh measurement here
    existing.push({
      t: thought.t,
      ox: thought.ox,
      oy: thought.oy,
      halfW: 1.5, // ~approximate half-width in world units
      halfH: 0.4, // ~approximate half-height
    });
  }

  if (existing.length === 0) return { t, ox, oy };

  // Try nudging
  let pos = { ...newBox };
  for (let attempt = 0; attempt < MAX_NUDGES; attempt++) {
    let hasOverlap = false;
    for (const ex of existing) {
      if (boxesOverlap(pos, ex)) {
        hasOverlap = true;
        // Nudge away from the overlapping thought
        const dx = pos.ox - ex.ox;
        const dy = pos.oy - ex.oy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        pos.ox += (dx / dist) * NUDGE_AMOUNT;
        pos.oy += (dy / dist) * NUDGE_AMOUNT;
        break;
      }
    }
    if (!hasOverlap) break;
  }

  // Clamp back inside tunnel after nudging
  const TUBE_MAX_R = 4 * 0.6; // TUBE_RADIUS * 0.6
  const nudgedR = Math.sqrt(pos.ox * pos.ox + pos.oy * pos.oy);
  if (nudgedR > TUBE_MAX_R) {
    const clampScale = TUBE_MAX_R / nudgedR;
    pos.ox *= clampScale;
    pos.oy *= clampScale;
  }

  // If still overlapping, shift t forward
  let still = false;
  for (const ex of existing) {
    if (boxesOverlap(pos, ex)) { still = true; break; }
  }
  if (still) {
    pos.t = Math.min(pos.t + 0.01, 0.94);
  }

  return { t: pos.t, ox: pos.ox, oy: pos.oy };
}
