import * as THREE from 'three';

const BASE_POINTS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(14, 6, 55),
  new THREE.Vector3(-12, -4, 110),
  new THREE.Vector3(10, 8, 165),
  new THREE.Vector3(-8, 2, 220),
  new THREE.Vector3(0, -2, 260),
];

// Mutable curve state
export let tunnelCurve = new THREE.CatmullRomCurve3(BASE_POINTS);

const SAMPLE_COUNT = 600;
let sampledPoints: THREE.Vector3[] = [];
let sampledTs: number[] = [];

function resample(): void {
  sampledPoints = [];
  sampledTs = [];
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    sampledTs.push(t);
    sampledPoints.push(tunnelCurve.getPoint(t));
  }
}

resample();

const UP = new THREE.Vector3(0, 1, 0);

export interface FrenetFrame {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
}

export function getCurvePoint(t: number): THREE.Vector3 {
  return tunnelCurve.getPoint(t);
}

export function getCurveFrame(t: number): FrenetFrame {
  const position = tunnelCurve.getPoint(t);
  const tangent = tunnelCurve.getTangent(t).normalize();

  const normal = new THREE.Vector3().crossVectors(tangent, UP).normalize();
  if (normal.lengthSq() < 0.001) {
    normal.set(1, 0, 0);
  }
  const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

  return { position, tangent, normal, binormal };
}

export function worldToParam(pos: THREE.Vector3): number {
  let bestT = 0;
  let bestDist = Infinity;

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const d = pos.distanceToSquared(sampledPoints[i]);
    if (d < bestDist) {
      bestDist = d;
      bestT = sampledTs[i];
    }
  }

  return bestT;
}

export function getCurveLength(): number {
  return tunnelCurve.getLength();
}

// Seeded pseudo-random for deterministic tunnel extension
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1; // -1 to 1
  };
}

let currentPointCount = BASE_POINTS.length;

export function rebuildCurve(thoughtCount: number): boolean {
  // Base: 6 points (~260 z-units). Every 10 thoughts beyond 20 adds one more point (~50 z-units).
  // Max: ~20 points (~960 z-units)
  const extraPoints = Math.max(0, Math.floor((thoughtCount - 20) / 10));
  const targetPoints = Math.min(BASE_POINTS.length + extraPoints, 20);

  if (targetPoints === currentPointCount) return false;

  const rand = seededRandom(42);
  const points = [...BASE_POINTS];
  let lastZ = BASE_POINTS[BASE_POINTS.length - 1].z;

  for (let i = BASE_POINTS.length; i < targetPoints; i++) {
    lastZ += 50;
    const x = rand() * 14;
    const y = rand() * 8;
    points.push(new THREE.Vector3(x, y, lastZ));
  }

  tunnelCurve = new THREE.CatmullRomCurve3(points);
  currentPointCount = targetPoints;
  resample();

  return true;
}

export function getCurrentPointCount(): number {
  return currentPointCount;
}
