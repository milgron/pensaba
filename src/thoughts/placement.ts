import * as THREE from 'three';
import { getCurveFrame } from '../tunnel/curve';

export function thoughtWorldPos(t: number, ox: number, oy: number): THREE.Vector3 {
  const frame = getCurveFrame(t);
  return frame.position
    .clone()
    .addScaledVector(frame.normal, ox)
    .addScaledVector(frame.binormal, oy);
}

export function thoughtQuaternion(t: number): THREE.Quaternion {
  const frame = getCurveFrame(t);
  // Orient so the text faces inward (toward curve center)
  // normal = inward direction, binormal = up, tangent = right
  const mat = new THREE.Matrix4().makeBasis(
    frame.tangent,
    frame.binormal,
    frame.normal.clone().negate()
  );
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}
