import * as THREE from 'three';

// Procedurally generated license-plate texture (no third-party assets).
// Shared by the main 3D floor-plan view and the VMS camera-grid feeds so both
// render the exact same plate/car look.
export function createPlateTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 5; ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text || '---', 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
