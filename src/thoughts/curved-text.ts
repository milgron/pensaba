import * as THREE from 'three';
import { tunnelCurve, getCurveFrame, getCurveLength } from '../tunnel/curve';
import { TUBE_RADIUS } from '../tunnel/tube';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import type { PreparedTextWithSegments } from '@chenglou/pretext';
import { measureText, ensureFontReady, LINE_HEIGHT } from './text-layout';
import type { TextMeasurement } from './text-layout';

const ARC_AMOUNT = 0.3;
const WORLD_SCALE = 0.008;
const RENDER_FONT_SIZE = 48;
const RENDER_LINE_HEIGHT = 62;
const RENDER_FONT = `300 ${RENDER_FONT_SIZE}px Inter, system-ui, sans-serif`;
const RENDER_MAX_WIDTH = 520;
const PADDING = 30;
const REPULSION_RADIUS = 120;
const REPULSION_STRENGTH = 45;

interface GlyphLayout {
  char: string;
  baseX: number;
  baseY: number;
  width: number;
  angle: number;
  arcOffsetY: number;
}

interface TextLayout {
  glyphs: GlyphLayout[];
  canW: number;
  canH: number;
  arcAmount: number;
  nickname: string;
  nicknameY: number;
}

export interface CurvedTextMesh {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  baseScale: THREE.Vector2;
  measurement: TextMeasurement;
  layout: TextLayout;
  text: string;
  repulsionActive: boolean;
  lastVisibleCount: number;
  dispose: () => void;
}

function computeArc(ox: number, oy: number, maxLineWidthPx: number): number {
  const r = Math.sqrt(ox * ox + oy * oy);
  const textWorldWidth = maxLineWidthPx * WORLD_SCALE;

  // Geometric arc: angle the text subtends on the cylinder at radius r
  const safeR = Math.max(r, 0.5);
  const geometricArc = textWorldWidth / safeR;

  // Blend: aesthetic near center, geometric near wall
  const wallThreshold = TUBE_RADIUS * 0.3;
  const wallRange = TUBE_RADIUS * 0.4;
  const wallFactor = Math.max(0, r - wallThreshold) / wallRange;
  const t = Math.min(1, wallFactor * wallFactor); // ease-in

  return ARC_AMOUNT + t * (geometricArc - ARC_AMOUNT);
}

// --- Feature 3: Per-segment widths from Pretext ---

function getSegmentGraphemeWidths(
  prepared: PreparedTextWithSegments,
  lineText: string,
  lineStart: { segmentIndex: number; graphemeIndex: number },
  lineEnd: { segmentIndex: number; graphemeIndex: number },
  fallbackCtx: CanvasRenderingContext2D,
): number[] {
  const segments = prepared.segments;
  const segWidths = (prepared as any).widths as number[];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const widths: number[] = [];

  // Walk segments that belong to this line
  for (let si = lineStart.segmentIndex; si <= lineEnd.segmentIndex && si < segments.length; si++) {
    const seg = segments[si];
    const segWidth = segWidths[si];
    const graphemes = [...segmenter.segment(seg)];

    // Determine which graphemes of this segment are in range
    const gStart = (si === lineStart.segmentIndex) ? lineStart.graphemeIndex : 0;
    const gEnd = (si === lineEnd.segmentIndex) ? lineEnd.graphemeIndex : graphemes.length;

    if (graphemes.length <= 1) {
      // Single-grapheme segment: width comes directly from Pretext
      if (gStart < gEnd) {
        widths.push(segWidth);
      }
    } else {
      // Multi-grapheme segment: distribute proportionally
      // Use canvas to measure individual graphemes within this segment only
      fallbackCtx.font = RENDER_FONT;
      const subWidths = graphemes.slice(gStart, gEnd).map(g => fallbackCtx.measureText(g.segment).width);
      const subTotal = subWidths.reduce((a, b) => a + b, 0);
      const scale = subTotal > 0 ? segWidth / subTotal : 1;
      for (const sw of subWidths) {
        widths.push(sw * scale);
      }
    }
  }

  return widths;
}

function computeTextLayout(text: string, ox: number, oy: number, nickname: string): TextLayout {
  const prepared = prepareWithSegments(text, RENDER_FONT);
  const result = layoutWithLines(prepared, RENDER_MAX_WIDTH, RENDER_LINE_HEIGHT);
  const lines = result.lines;

  const maxLineWidth = Math.max(...lines.map(l => l.width));
  const arcAmount = computeArc(ox, oy, maxLineWidth);
  const arcExtraHeight = maxLineWidth * Math.sin(arcAmount / 2) * 0.5;
  const NICK_LINE_HEIGHT = 36;
  const canW = Math.ceil(maxLineWidth + PADDING * 2);
  const canH = Math.ceil(lines.length * RENDER_LINE_HEIGHT + PADDING * 2 + arcExtraHeight + NICK_LINE_HEIGHT);

  const measureCan = document.createElement('canvas');
  const mCtx = measureCan.getContext('2d')!;
  mCtx.font = RENDER_FONT;

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const glyphs: GlyphLayout[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineWidth = line.width;
    const lineY = PADDING + lineIdx * RENDER_LINE_HEIGHT + arcExtraHeight / 2;
    const lineX = PADDING + (maxLineWidth - lineWidth) / 2;

    // Feature 3: Use Pretext segment widths where possible
    const graphemes = [...segmenter.segment(line.text)];
    let glyphWidths: number[];

    try {
      glyphWidths = getSegmentGraphemeWidths(prepared, line.text, line.start, line.end, mCtx);
      // If length mismatch (edge case), fall back
      if (glyphWidths.length !== graphemes.length) {
        glyphWidths = graphemes.map(g => {
          mCtx.font = RENDER_FONT;
          return mCtx.measureText(g.segment).width;
        });
      }
    } catch {
      // Fallback to canvas
      glyphWidths = graphemes.map(g => {
        mCtx.font = RENDER_FONT;
        return mCtx.measureText(g.segment).width;
      });
    }

    let cx = 0;
    for (let i = 0; i < graphemes.length; i++) {
      const char = graphemes[i].segment;
      const charWidth = glyphWidths[i];
      const charCenterX = cx + charWidth / 2;

      const normalizedX = (charCenterX - lineWidth / 2) / (lineWidth / 2 || 1);
      const angle = normalizedX * arcAmount / 2;
      const arcOffsetY = (1 - Math.cos(angle)) * lineWidth * 0.15;

      glyphs.push({
        char,
        baseX: lineX + charCenterX,
        baseY: lineY + RENDER_FONT_SIZE * 0.8 + arcOffsetY,
        width: charWidth,
        angle,
        arcOffsetY,
      });

      cx += charWidth;
    }
  }

  const nicknameY = lines.length * RENDER_LINE_HEIGHT + PADDING + arcExtraHeight / 2 + NICK_LINE_HEIGHT * 0.6;
  return { glyphs, canW, canH, arcAmount, nickname, nicknameY };
}

// --- Feature 1: Progressive reveal via charFraction ---

function renderGlyphs(
  canvas: HTMLCanvasElement,
  layout: TextLayout,
  charFraction: number = 1,
  mouseX?: number,
  mouseY?: number,
): number {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(2, 2);

  const visibleCount = Math.ceil(layout.glyphs.length * Math.max(0, Math.min(1, charFraction)));

  for (let i = 0; i < visibleCount; i++) {
    const g = layout.glyphs[i];
    let dx = 0;
    let dy = 0;

    if (mouseX !== undefined && mouseY !== undefined && g.char.trim()) {
      const distX = g.baseX - mouseX;
      const distY = g.baseY - mouseY;
      const dist = Math.sqrt(distX * distX + distY * distY);

      if (dist < REPULSION_RADIUS && dist > 0.1) {
        const force = (1 - dist / REPULSION_RADIUS);
        const eased = force * force * force;
        dx = (distX / dist) * eased * REPULSION_STRENGTH;
        dy = (distY / dist) * eased * REPULSION_STRENGTH;
      }
    }

    // Fade in the last few visible glyphs for smooth reveal
    let alpha = 1;
    if (charFraction < 1 && i >= visibleCount - 3) {
      const fadePos = (visibleCount - i) / 3;
      alpha = Math.min(1, fadePos);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(g.baseX + dx, g.baseY + dy);
    ctx.rotate(g.angle);
    ctx.font = RENDER_FONT;
    ctx.fillStyle = '#e0e0e0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.char, 0, 0);
    ctx.restore();
  }

  // Render nickname below the text (flat, no arc)
  if (charFraction >= 0.5 && layout.nickname) {
    const nickAlpha = Math.min(1, (charFraction - 0.5) * 4);
    ctx.globalAlpha = nickAlpha * 0.35;
    ctx.font = `300 ${RENDER_FONT_SIZE * 0.55}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#e0e0e0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('— ' + layout.nickname, layout.canW / 2, layout.nicknameY);
  }

  ctx.restore();
  return visibleCount;
}

export function rerenderWithRepulsion(
  mesh: CurvedTextMesh,
  mouseCanvasX: number,
  mouseCanvasY: number,
  charFraction: number = 1,
): void {
  mesh.lastVisibleCount = renderGlyphs(mesh.canvas, mesh.layout, charFraction, mouseCanvasX, mouseCanvasY);
  mesh.texture.needsUpdate = true;
  mesh.repulsionActive = true;
}

export function rerenderWithReveal(
  mesh: CurvedTextMesh,
  charFraction: number,
): void {
  const newCount = Math.ceil(mesh.layout.glyphs.length * Math.max(0, Math.min(1, charFraction)));
  // Only re-render if visible glyph count actually changed
  if (newCount === mesh.lastVisibleCount && !mesh.repulsionActive) return;

  mesh.lastVisibleCount = renderGlyphs(mesh.canvas, mesh.layout, charFraction);
  mesh.texture.needsUpdate = true;
  mesh.repulsionActive = false;
}

export function rerenderClean(mesh: CurvedTextMesh, charFraction: number = 1): void {
  if (!mesh.repulsionActive && mesh.lastVisibleCount === mesh.layout.glyphs.length) return;
  mesh.lastVisibleCount = renderGlyphs(mesh.canvas, mesh.layout, charFraction);
  mesh.texture.needsUpdate = true;
  mesh.repulsionActive = false;
}

export async function createCurvedTextMesh(
  text: string,
  thoughtT: number,
  ox: number,
  oy: number,
  nickname: string = '',
): Promise<CurvedTextMesh> {
  await ensureFontReady();

  const measurement = measureText(text);
  const layout = computeTextLayout(text, ox, oy, nickname);

  const canvas = document.createElement('canvas');
  canvas.width = layout.canW * 2;
  canvas.height = layout.canH * 2;

  // Start empty — the renderer's first frame will set the correct charFraction
  const visibleCount = renderGlyphs(canvas, layout, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,
  });

  const sprite = new THREE.Sprite(material);
  const sw = layout.canW * WORLD_SCALE;
  const sh = layout.canH * WORLD_SCALE;
  sprite.scale.set(sw, sh, 1);

  const frame = getCurveFrame(thoughtT);
  const pos = frame.position.clone()
    .addScaledVector(frame.normal, ox)
    .addScaledVector(frame.binormal, oy);
  sprite.position.copy(pos);

  return {
    sprite, material, texture, canvas,
    baseScale: new THREE.Vector2(sw, sh),
    measurement, layout, text,
    repulsionActive: false,
    lastVisibleCount: visibleCount,
    dispose: () => { material.dispose(); texture.dispose(); },
  };
}

// --- Feature 2: Collision bounding box ---
export function measureThoughtBounds(text: string): { width: number; height: number } {
  const prepared = prepareWithSegments(text, RENDER_FONT);
  const result = layoutWithLines(prepared, RENDER_MAX_WIDTH, RENDER_LINE_HEIGHT);
  return {
    width: Math.max(...result.lines.map(l => l.width)) * WORLD_SCALE,
    height: result.lines.length * RENDER_LINE_HEIGHT * WORLD_SCALE,
  };
}
