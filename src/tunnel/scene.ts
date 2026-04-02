import * as THREE from 'three';
import { createTubeMesh, createTubeWall } from './tube';

export let renderer: THREE.WebGLRenderer;
export let camera: THREE.PerspectiveCamera;
export let scene: THREE.Scene;
export let tubeMesh: THREE.Mesh;

let wallMesh: THREE.Mesh;

export function initScene(canvas: HTMLCanvasElement): void {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.008);

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );

  wallMesh = createTubeWall();
  scene.add(wallMesh);
  tubeMesh = createTubeMesh();
  scene.add(tubeMesh);

  window.addEventListener('resize', onResize);
}

export function rebuildTubeMeshes(): void {
  // Dispose old
  scene.remove(wallMesh);
  wallMesh.geometry.dispose();
  (wallMesh.material as THREE.Material).dispose();

  scene.remove(tubeMesh);
  tubeMesh.geometry.dispose();
  (tubeMesh.material as THREE.Material).dispose();

  // Create new
  wallMesh = createTubeWall();
  scene.add(wallMesh);
  tubeMesh = createTubeMesh();
  scene.add(tubeMesh);
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
