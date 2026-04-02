import * as THREE from 'three';
import { tunnelCurve } from './curve';

export const TUBE_RADIUS = 4;

export function createTubeMesh(): THREE.Mesh {
  const geometry = new THREE.TubeGeometry(
    tunnelCurve,
    300,         // tubularSegments
    TUBE_RADIUS,
    16,          // radialSegments
    false        // closed
  );

  // Wireframe overlay for depth perception
  const material = new THREE.MeshBasicMaterial({
    color: 0x3a3a5c,
    side: THREE.BackSide,
    wireframe: true,
    transparent: true,
    opacity: 0.25,
  });

  return new THREE.Mesh(geometry, material);
}

export function createTubeWall(): THREE.Mesh {
  const geometry = new THREE.TubeGeometry(
    tunnelCurve,
    300,
    TUBE_RADIUS,
    16,
    false
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0x08080e,
    side: THREE.BackSide,
  });

  return new THREE.Mesh(geometry, material);
}
