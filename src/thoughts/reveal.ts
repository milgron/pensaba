const STAGES = [
  { maxDist: 55, minDist: 45, opacity: [0, 0.25], scale: [0, 0.4] },
  { maxDist: 45, minDist: 30, opacity: [0.25, 0.55], scale: [0.4, 0.7] },
  { maxDist: 30, minDist: 18, opacity: [0.55, 0.8], scale: [0.7, 0.88] },
  { maxDist: 18, minDist: 8, opacity: [0.8, 0.95], scale: [0.88, 0.97] },
  { maxDist: 8, minDist: 0, opacity: [0.95, 1.0], scale: [0.97, 1.0] },
];

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

export interface RevealState {
  opacity: number;
  scale: number;
  charFraction: number;
}

export function computeReveal(distance: number): RevealState {
  if (distance > 55) {
    return { opacity: 0, scale: 0, charFraction: 0 };
  }

  for (const stage of STAGES) {
    if (distance > stage.minDist && distance <= stage.maxDist) {
      const f = 1 - (distance - stage.minDist) / (stage.maxDist - stage.minDist);
      return {
        opacity: lerp(stage.opacity[0], stage.opacity[1], f),
        scale: lerp(stage.scale[0], stage.scale[1], f),
        charFraction: distance > 38 ? 0.12
          : distance > 24 ? lerp(0.12, 0.35, (38 - distance) / 14)
          : distance > 14 ? lerp(0.35, 0.65, (24 - distance) / 10)
          : distance > 6 ? lerp(0.65, 0.88, (14 - distance) / 8)
          : 1.0,
      };
    }
  }

  return { opacity: 1, scale: 1, charFraction: 1 };
}
