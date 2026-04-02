import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import type { PreparedTextWithSegments } from '@chenglou/pretext';

const FONT = '300 18px Inter, system-ui, sans-serif';
const MAX_WIDTH = 280;
const LINE_HEIGHT = 26;

let fontReady = false;
let fontReadyPromise: Promise<void> | null = null;

export function ensureFontReady(): Promise<void> {
  if (fontReady) return Promise.resolve();
  if (fontReadyPromise) return fontReadyPromise;

  fontReadyPromise = (async () => {
    try {
      const face = new FontFace('Inter', 'url(https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.woff2)', {
        weight: '300',
        style: 'normal',
      });
      const loaded = await face.load();
      document.fonts.add(loaded);
    } catch {
      // fallback to system font
    }
    await document.fonts.ready;
    fontReady = true;
  })();

  return fontReadyPromise;
}

export interface GlyphInfo {
  char: string;
  x: number;       // cumulative x offset within line
  width: number;    // glyph advance width
  line: number;     // line index
  lineY: number;    // y offset of this line
}

export interface TextMeasurement {
  glyphs: GlyphInfo[];
  totalWidth: number;
  totalHeight: number;
  lineCount: number;
}

export function measureText(text: string): TextMeasurement {
  const prepared = prepareWithSegments(text, FONT);
  const result = layoutWithLines(prepared, MAX_WIDTH, LINE_HEIGHT);

  const glyphs: GlyphInfo[] = [];
  let maxLineWidth = 0;

  for (let lineIdx = 0; lineIdx < result.lines.length; lineIdx++) {
    const line = result.lines[lineIdx];
    const lineY = lineIdx * LINE_HEIGHT;

    // Extract per-glyph widths from this line
    const lineGlyphs = extractGlyphWidths(prepared, line.text);
    let cx = 0;

    for (const g of lineGlyphs) {
      glyphs.push({
        char: g.char,
        x: cx,
        width: g.width,
        line: lineIdx,
        lineY,
      });
      cx += g.width;
    }

    maxLineWidth = Math.max(maxLineWidth, line.width);
  }

  return {
    glyphs,
    totalWidth: maxLineWidth,
    totalHeight: result.lines.length * LINE_HEIGHT,
    lineCount: result.lines.length,
  };
}

// Canvas-based per-glyph measurement (reliable fallback)
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

function extractGlyphWidths(prepared: PreparedTextWithSegments, lineText: string): { char: string; width: number }[] {
  measureCtx.font = FONT;
  const result: { char: string; width: number }[] = [];

  // Use the Intl.Segmenter for proper grapheme clusters
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const segments = [...segmenter.segment(lineText)];

  for (const seg of segments) {
    const w = measureCtx.measureText(seg.segment).width;
    result.push({ char: seg.segment, width: w });
  }

  return result;
}

export { FONT, LINE_HEIGHT, MAX_WIDTH };
