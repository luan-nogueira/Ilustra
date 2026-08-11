import React, { useRef, useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useProjectStore, WallSegment, SceneObject } from '../../store/useProjectStore';
import { StorageCalculator } from '../Calculator/StorageCalculator';
import { calculateDORIZones, calculateFOV } from '../../utils/cameraMath';
import { exportProjectToPDF } from '../../utils/exportPdf';
import { generatePlate } from '../../utils/plateGen';
import { CAMERA_CATALOG } from '../Dashboard/CatalogModal';
import { v4 as uuidv4 } from 'uuid';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const FloorPlan3D = lazy(() => import('../Map/FloorPlan3D'));

// ─── Constants ────────────────────────────────────────────────────────────────
const getPPM = () => useProjectStore.getState().pixelsPerMeter;


const FURNITURE_SIZES: Record<string, [number, number]> = {
  column: [0.6, 0.6], bed: [1.6, 2.0], sofa: [2.0, 0.9],
  chair: [0.6, 0.6],  table: [1.4, 0.7], person: [0.5, 0.5], car: [4.5, 1.8],
  reader: [0.2, 0.1], controller: [0.5, 0.3], door: [0.9, 0.15],
  rack: [0.6, 0.9], door_heavy: [1.2, 0.25], door_sliding: [1.6, 0.12], door_auto: [1.6, 0.2],
};
const FURNITURE_LABELS: Record<string, string> = {
  column: 'Coluna', bed: 'Cama', sofa: 'Sofá', chair: 'Cadeira', table: 'Mesa', person: 'Pessoa', car: 'Carro',
  reader: 'Leitora', controller: 'Controladora', door: 'Porta',
  rack: 'Rack 19"', door_heavy: 'Porta Pesada', door_sliding: 'Porta Corrediça', door_auto: 'Porta Automatizada',
};
const DOOR_TYPES = new Set(['door', 'door_heavy', 'door_sliding', 'door_auto']);
const CAM_COLORS: Record<string, string> = {
  'Illustra Pro 4MP':    '#0ea5e9',
  'Illustra Pro 8MP 4K': '#f59e0b',
  'Illustra Flex 2MP':   '#22c55e',
  'Illustra Radar':      '#ef4444',
};

type Tool     = 'select' | 'wall' | 'camera' | 'furniture' | 'erase' | 'scale';
type ViewMode = '2d' | '3d';

// ─── Coordinate helpers ───────────────────────────────────────────────────────
const toCanvas = (wx: number, wy: number, pan:{x:number;y:number}, zoom:number, W:number, H:number) => ({
  x: wx * getPPM() * zoom + pan.x + W / 2,
  y: wy * getPPM() * zoom + pan.y + H / 2,
});
const toWorld = (cx:number, cy:number, pan:{x:number;y:number}, zoom:number, W:number, H:number) => ({
  x: (cx - pan.x - W/2) / (getPPM() * zoom),
  y: (cy - pan.y - H/2) / (getPPM() * zoom),
});
const snap = (v: number, gs = 0.25) => Math.round(v / gs) * gs;

// Camera heading angle → canvas angle
// rotation[1] = 0 → North (canvas -Y = -π/2)
// Formula: canvasAngle = -rotation[1] - π/2
const r1ToCanvas = (r1: number) => -r1 - Math.PI / 2;

// ─── Ray casting – Visibility Polygon ────────────────────────────────────────

/** Returns closest t along the ray (ox,oy)+(dx,dy)*t that hits any wall segment, or maxT */
function rayHitWalls(
  ox: number, oy: number, dx: number, dy: number,
  walls: WallSegment[], maxT: number,
): number {
  let closest = maxT;
  for (const w of walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (len < 0.001) continue;
    
    // Extend the wall segment slightly by its thickness/2 to perfectly close corner gaps!
    const ext = (w.thickness ?? 0.2) / 2;
    const nx = (w.x2 - w.x1) / len;
    const ny = (w.y2 - w.y1) / len;
    const ex1 = w.x1 - nx * ext;
    const ey1 = w.y1 - ny * ext;
    const ex2 = w.x2 + nx * ext;
    const ey2 = w.y2 + ny * ext;

    const ex = ex2 - ex1, ey = ey2 - ey1;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;
    
    const t2 = ((ex1 - ox) * dy - (ey1 - oy) * dx) / denom;
    if (t2 < -0.001 || t2 > 1.001) continue;
    
    const t1 = ((ex1 - ox) * ey - (ey1 - oy) * ex) / denom;
    if (t1 > 0.001 && t1 < closest) closest = t1;
  }
  return closest;
}

/** Compute the wall-clipped FOV polygon for a camera (in world coords) */
function computeVisibilityPoly(
  camX: number, camY: number,
  centerAngle: number, // canvas/world angle (r1ToCanvas result)
  halfFovRad: number,
  maxRange: number,
  walls: WallSegment[],
  numRays = 80,
): [number, number][] {
  let ox = camX, oy = camY;
  const cdx = Math.cos(centerAngle), cdy = Math.sin(centerAngle);

  // Iteratively push the raycast origin firmly into the room, away from all nearby walls
  for (let pass = 0; pass < 3; pass++) {
    for (const w of walls) {
      const l2 = (w.x2 - w.x1)**2 + (w.y2 - w.y1)**2;
      if (l2 < 0.001) continue;
      let t = ((ox - w.x1) * (w.x2 - w.x1) + (oy - w.y1) * (w.y2 - w.y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = w.x1 + t * (w.x2 - w.x1);
      const py = w.y1 + t * (w.y2 - w.y1);
      
      if (Math.hypot(ox - px, oy - py) < 0.5) {
        let nx = -(w.y2 - w.y1) / Math.sqrt(l2);
        let ny = (w.x2 - w.x1) / Math.sqrt(l2);
        if (nx * cdx + ny * cdy < 0) { nx = -nx; ny = -ny; }
        
        if (nx * cdx + ny * cdy > 0.01) {
          const ext = (w.thickness ?? 0.2) / 2 + 0.05;
          const dot = (ox - px) * nx + (oy - py) * ny;
          if (dot < ext) {
            const push = ext - dot;
            ox += nx * push;
            oy += ny * push;
          }
        }
      }
    }
  }

  const pts: [number, number][] = [[ox, oy]];
  for (let i = 0; i <= numRays; i++) {
    const angle = centerAngle - halfFovRad + (i / numRays) * 2 * halfFovRad;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const t = rayHitWalls(ox, oy, dx, dy, walls, maxRange);
    pts.push([ox + dx * t, oy + dy * t]);
  }
  return pts;
}

/** Point-in-polygon test (winding number / even-odd) */
function pointInPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Calculate area of a polygon */
function getPolygonArea(pts: [number, number][]) {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(area / 2);
}

// ─── Canvas draw functions ─────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, pan:{x:number;y:number}, zoom:number, W:number, H:number) {
  const gMinor = getPPM() * zoom, gMajor = gMinor * 5;
  const ox = pan.x + W / 2, oy = pan.y + H / 2;
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
  for (let x = ox % gMinor - gMinor; x < W + gMinor; x += gMinor) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = oy % gMinor - gMinor; y < H + gMinor; y += gMinor) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.strokeStyle = '#c7d2dc'; ctx.lineWidth = 1;
  for (let x = ox % gMajor - gMajor; x < W + gMajor; x += gMajor) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    if (zoom > 0.4) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(`${((x - ox) / (getPPM() * zoom)).toFixed(0)}m`, x, 2);
    }
  }
  for (let y = oy % gMajor - gMajor; y < H + gMajor; y += gMajor) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    if (zoom > 0.4) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter,monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`${((y - oy) / (getPPM() * zoom)).toFixed(0)}m`, 2, y + 2);
    }
  }
  // Origin
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox - 8, oy); ctx.lineTo(ox + 8, oy);
  ctx.moveTo(ox, oy - 8); ctx.lineTo(ox, oy + 8);
  ctx.stroke();
}

function drawWall(
  ctx: CanvasRenderingContext2D, wall: WallSegment,
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
  selected: boolean, hovered: boolean,
) {
  const p1 = toCanvas(wall.x1, wall.y1, pan, zoom, W, H);
  const p2 = toCanvas(wall.x2, wall.y2, pan, zoom, W, H);
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (len < 1) return;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const halfT = (wall.thickness * getPPM() * zoom) / 2;

  ctx.save();
  ctx.translate(p1.x, p1.y); ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = selected ? '#bfdbfe' : hovered ? '#f1f5f9' : '#e8ecf0';
  ctx.strokeStyle = selected ? '#2563eb' : '#475569';
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.beginPath(); ctx.rect(0, -halfT, len, halfT * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // Hatching
  ctx.strokeStyle = selected ? 'rgba(37,99,235,0.25)' : 'rgba(100,116,139,0.3)';
  ctx.lineWidth = 0.8;
  const hs = Math.max(4, halfT * 0.6);
  for (let hx = 0; hx < len; hx += hs) {
    ctx.beginPath(); ctx.moveTo(hx, -halfT); ctx.lineTo(hx - halfT * 2, halfT); ctx.stroke();
  }
  // Length label when selected
  if (selected && zoom > 0.6) {
    const wl = Math.hypot(wall.x2-wall.x1, wall.y2-wall.y1).toFixed(2);
    ctx.fillStyle = '#1d4ed8'; ctx.font = 'bold 11px Inter,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${wl}m`, len/2, -halfT - 4);
  }
  ctx.restore();
}

function drawWallPreview(
  ctx: CanvasRenderingContext2D,
  x1:number, y1:number, x2:number, y2:number, thickness:number,
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
) {
  const p1 = toCanvas(x1, y1, pan, zoom, W, H);
  const p2 = toCanvas(x2, y2, pan, zoom, W, H);
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (len < 2) return;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const halfT = (thickness * getPPM() * zoom) / 2;
  const wl = Math.hypot(x2-x1, y2-y1).toFixed(2);

  ctx.save();
  ctx.translate(p1.x, p1.y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(59,130,246,0.18)';
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.setLineDash([6,4]);
  ctx.beginPath(); ctx.rect(0, -halfT, len, halfT * 2); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#1d4ed8'; ctx.font = 'bold 12px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`${wl}m`, len/2, -halfT - 5);
  ctx.fillStyle = '#4b72b0'; ctx.font = '10px Inter,sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`e: ${(thickness*100).toFixed(0)}cm`, len/2, halfT + 4);
  ctx.restore();
}

/** Draw wall-clipped FOV polygon for one camera */
function drawFOVPoly(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  color: string,
  camRange: number,
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
  cameraObj?: SceneObject
) {
  if (pts.length < 3) return;
  ctx.beginPath();
  const p0 = toCanvas(pts[0][0], pts[0][1], pan, zoom, W, H);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < pts.length; i++) {
    const p = toCanvas(pts[i][0], pts[i][1], pan, zoom, W, H);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  
  const rCanvas = camRange * getPPM() * zoom;
  const grad = ctx.createRadialGradient(p0.x, p0.y, 0, p0.x, p0.y, rCanvas);
  
  if (cameraObj) {
    const f = cameraObj.focalLength ?? 2.8;
    const sw = cameraObj.sensorWidth ?? 5.27; // 1/2.8"
    const resStr = cameraObj.resolution ?? '1920x1080';
    const rw = parseInt(resStr.split('x')[0]) || 1920;
    
    const dori = calculateDORIZones(rw, f, sw);
    
    // Converter distâncias em stops (0 a 1) baseados no raio desenhado (camRange)
    const sIden = Math.min(1, dori.identify / camRange);
    const sReco = Math.min(1, dori.recognize / camRange);
    const sObse = Math.min(1, dori.observe / camRange);
    const sDete = Math.min(1, dori.detect / camRange);
    const sMoni = Math.min(1, dori.monitor / camRange);

    // Identificação (Vermelho)
    grad.addColorStop(0.0, 'rgba(239, 68, 68, 0.4)');
    grad.addColorStop(sIden, 'rgba(239, 68, 68, 0.4)');
    // Reconhecimento (Amarelo)
    if (sIden < 1) {
      grad.addColorStop(sIden + 0.001, 'rgba(250, 204, 21, 0.4)');
      grad.addColorStop(sReco, 'rgba(250, 204, 21, 0.4)');
    }
    // Observação (Verde)
    if (sReco < 1) {
      grad.addColorStop(sReco + 0.001, 'rgba(34, 197, 94, 0.4)');
      grad.addColorStop(sObse, 'rgba(34, 197, 94, 0.4)');
    }
    // Detecção (Ciano)
    if (sObse < 1) {
      grad.addColorStop(sObse + 0.001, 'rgba(6, 182, 212, 0.4)');
      grad.addColorStop(sDete, 'rgba(6, 182, 212, 0.4)');
    }
    // Monitoramento (Azul)
    if (sDete < 1) {
      grad.addColorStop(sDete + 0.001, 'rgba(59, 130, 246, 0.4)');
      grad.addColorStop(Math.max(sDete + 0.001, sMoni), 'rgba(59, 130, 246, 0.4)');
    }
    if (sMoni < 1) {
      grad.addColorStop(sMoni + 0.001, 'rgba(148, 163, 184, 0.2)');
      grad.addColorStop(1.0, 'rgba(148, 163, 184, 0.2)');
    }
  } else {
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
  }

  ctx.fillStyle = grad;
  ctx.fill();
  
  ctx.strokeStyle = color + '66'; 
  ctx.lineWidth = 1.0;
  ctx.stroke();
}

function drawCamera(
  ctx: CanvasRenderingContext2D,
  cam: SceneObject, label: string, selected: boolean,
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
) {
  const p = toCanvas(cam.position[0], cam.position[2], pan, zoom, W, H);
  const color = cam.color ?? '#0ea5e9';
  const midAngle = r1ToCanvas(cam.rotation[1]);
  const r = 12;

  const type = cam.model?.toLowerCase().includes('flex') ? 'dome' : 
               cam.model?.toLowerCase().includes('pro') ? 'bullet' : 'radar';

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(midAngle);

  // Glow on select
  if (selected) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }

  if (type === 'dome') {
     // Dome Camera (Circular base with glass dome)
     ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2);
     ctx.fillStyle = '#ffffff'; ctx.fill(); 
     ctx.lineWidth = selected ? 3 : 2; ctx.strokeStyle = color; ctx.stroke();
     ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
     ctx.fillStyle = '#1e293b'; ctx.fill();
     ctx.beginPath(); ctx.arc(3, -3, 2, 0, Math.PI * 2);
     ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(); // Reflexo
  } else if (type === 'bullet') {
     // Bullet Camera (Cylindrical)
     ctx.beginPath(); ctx.roundRect(-8, -14, 16, 28, 4);
     ctx.fillStyle = '#ffffff'; ctx.fill(); 
     ctx.lineWidth = selected ? 3 : 2; ctx.strokeStyle = color; ctx.stroke();
     ctx.beginPath(); ctx.roundRect(-6, 8, 12, 4, 2);
     ctx.fillStyle = '#1e293b'; ctx.fill(); // Lente
  } else {
     // Radar (Dish)
     ctx.beginPath(); ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI*2);
     ctx.fillStyle = '#1e293b'; ctx.fill(); 
     ctx.lineWidth = selected ? 3 : 2; ctx.strokeStyle = color; ctx.stroke();
     ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill();
  }

  ctx.restore();

  // Label
  if (zoom > 0.5) {
    ctx.fillStyle = '#1e293b'; ctx.font = `${selected ? 'bold ' : ''}10px Inter,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(label, p.x, p.y + r + 4);
  }
  // FOV badge on selection
  if (selected) {
    const txt = `${cam.fov ?? 75}°  •  ${cam.range ?? 10}m`;
    ctx.font = '10px Inter,sans-serif';
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.roundRect(p.x - tw/2 - 6, p.y - r - 22, tw + 12, 18, 4); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, p.x, p.y - r - 13);
  }
}

function drawFurniture(
  ctx: CanvasRenderingContext2D, obj: SceneObject, selected: boolean,
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
) {
  const p = toCanvas(obj.position[0], obj.position[2], pan, zoom, W, H);
  const [bw, bh] = FURNITURE_SIZES[obj.type] ?? [1, 1];
  const w = bw * obj.scale[0] * getPPM() * zoom;
  const h = bh * obj.scale[2] * getPPM() * zoom;

  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(obj.rotation[1]);

  if (DOOR_TYPES.has(obj.type)) {
    // Door leaf + swing arc, styled per sub-type
    const doorColor = obj.type === 'door_heavy' ? '#334155'
      : obj.type === 'door_sliding' ? '#0e7490'
      : obj.type === 'door_auto' ? '#7c3aed'
      : (obj.color ?? '#78350f');
    ctx.strokeStyle = doorColor;
    ctx.lineWidth = obj.type === 'door_heavy' ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(-w/2, -w); ctx.stroke();

    if (obj.type === 'door_sliding') {
      // Overhead rail + door panel offset to the side (parked open along the rail)
      ctx.strokeStyle = doorColor; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-w/2, 3); ctx.lineTo(w/2, 3); ctx.stroke();
      ctx.fillStyle = doorColor + '55';
      ctx.fillRect(-w/2 - 2, -1.5, w * 0.6, 3);
    } else if (obj.type === 'door_auto') {
      // Motor/sensor housing above the opening
      ctx.fillStyle = doorColor;
      ctx.fillRect(-w/2 - 2, 4, w + 4, 4);
      ctx.beginPath(); ctx.arc(0, 6, 2, 0, Math.PI * 2); ctx.fillStyle = '#22c55e'; ctx.fill();
      ctx.strokeStyle = 'rgba(124,58,237,0.3)'; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.arc(-w/2, 0, w, 1.5*Math.PI, 2*Math.PI); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.beginPath(); ctx.arc(-w/2, 0, w, 1.5*Math.PI, 2*Math.PI);
      ctx.strokeStyle = doorColor + '4d'; ctx.setLineDash([2, 2]); ctx.stroke();
      ctx.setLineDash([]);
    }
  } else if (obj.type === 'rack') {
    // 19" server rack cabinet – dark box with U-slot rungs
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.fillStyle = selected ? '#1e40af' : '#111827';
    ctx.strokeStyle = selected ? '#2563eb' : '#374151';
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(-w/2, -h/2, w, h, 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    if (zoom > 0.5) {
      ctx.strokeStyle = 'rgba(148,163,184,0.5)'; ctx.lineWidth = 0.6;
      const rungs = 6;
      for (let i = 1; i < rungs; i++) {
        const ry = -h/2 + (h / rungs) * i;
        ctx.beginPath(); ctx.moveTo(-w/2 + 2, ry); ctx.lineTo(w/2 - 2, ry); ctx.stroke();
      }
    }
    ctx.fillStyle = '#22c55e';
    ctx.beginPath(); ctx.arc(w/2 - 3, -h/2 + 3, 1.2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.fillStyle = selected ? '#bfdbfe' : (obj.color ?? '#e2e8f0');
    ctx.strokeStyle = selected ? '#2563eb' : '#64748b';
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(-w/2, -h/2, w, h, 3); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = selected ? '#1d4ed8' : '#94a3b8'; ctx.lineWidth = 1;
    if (obj.type === 'table' && zoom > 0.6) ctx.strokeRect(-w/2+3, -h/2+3, w-6, h-6);
    if (obj.type === 'sofa' && zoom > 0.6) { ctx.beginPath(); ctx.rect(-w/2+2, h/2-8, w-4, 6); ctx.stroke(); }
    if (obj.type === 'chair' && zoom > 0.6) { ctx.beginPath(); ctx.arc(0, 0, Math.min(w,h)/3, 0, Math.PI*2); ctx.stroke(); }
  }

  if (selected && zoom > 0.7 && !DOOR_TYPES.has(obj.type)) {
    ctx.font = 'bold 9px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = obj.type === 'rack' ? '#93c5fd' : '#1e3a5f';
    ctx.fillText(FURNITURE_LABELS[obj.type] ?? obj.type, 0, 0);
  }
  ctx.restore();
}

/** Draw a car with license-plate readout and an LPR "plate read" indicator ring */
function drawCar(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  selected: boolean,
  isPlateRead: boolean,
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
) {
  const p = toCanvas(obj.position[0], obj.position[2], pan, zoom, W, H);
  const [bw, bh] = FURNITURE_SIZES['car'] ?? [4.5, 1.8];
  const w = bw * obj.scale[0] * getPPM() * zoom;
  const h = bh * obj.scale[2] * getPPM() * zoom;

  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(obj.rotation[1]);

  ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  ctx.fillStyle = selected ? '#bfdbfe' : (obj.color ?? '#94a3b8');
  ctx.strokeStyle = isPlateRead ? '#22c55e' : (selected ? '#2563eb' : '#64748b');
  ctx.lineWidth = isPlateRead ? 2.5 : (selected ? 1.5 : 1);
  ctx.beginPath(); ctx.roundRect(-w/2, -h/2, w, h, Math.min(6, h/3)); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // Windshield hint
  ctx.fillStyle = 'rgba(15,23,42,0.35)';
  ctx.fillRect(-w*0.15, -h/2 + 2, w*0.3, h - 4);

  if (isPlateRead && zoom > 0.4) {
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#052e16';
    const plateW = Math.min(w * 0.5, 34), plateH = 9;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(-plateW/2, h/2 - plateH - 2, plateW, plateH);
    ctx.strokeStyle = '#052e16'; ctx.lineWidth = 0.6; ctx.strokeRect(-plateW/2, h/2 - plateH - 2, plateW, plateH);
    ctx.fillStyle = '#052e16';
    ctx.fillText(obj.plate ?? '---', 0, h/2 - plateH/2 - 2);
  }

  ctx.restore();

  if (isPlateRead && zoom > 0.4) {
    ctx.save();
    ctx.font = 'bold 9px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#052e16';
    const label = `LPR ✓ ${obj.plate ?? ''}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = '#bbf7d0';
    ctx.beginPath(); ctx.roundRect(p.x - tw/2 - 5, p.y + h/2 + 4, tw + 10, 16, 4); ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.fillText(label, p.x, p.y + h/2 + 7);
    ctx.restore();
  }
}

/** Draw a person with a visibility indicator ring */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  selected: boolean,
  isDetected: boolean,
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
) {
  const p = toCanvas(obj.position[0], obj.position[2], pan, zoom, W, H);
  const baseColor = obj.color ?? '#ffb6c1';
  const ringColor = isDetected ? '#22c55e' : '#ef4444';
  const r = Math.max(8, 14 * zoom);

  ctx.save();
  ctx.translate(p.x, p.y);

  // Outer detection ring (pulsing-like via shadow)
  ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Body circle
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = selected ? '#fff' : baseColor;
  ctx.fill();
  ctx.strokeStyle = selected ? '#2563eb' : '#64748b';
  ctx.lineWidth = selected ? 2 : 1;
  ctx.stroke();

  // Person icon (head + body)
  ctx.fillStyle = selected ? '#2563eb' : '#555';
  ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill(); // head
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.02);
  ctx.lineTo(r * 0.25, -r * 0.02);
  ctx.lineTo(r * 0.18, r * 0.52);
  ctx.lineTo(-r * 0.18, r * 0.52);
  ctx.closePath(); ctx.fill(); // body

  // Status label
  if (zoom > 0.5) {
    ctx.font = `bold 9px Inter,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = ringColor;
    ctx.fillText(isDetected ? '✓ Visível' : '✗ Oculto', 0, r + 8);
  }

  ctx.restore();
}

let blindSpotPattern: CanvasPattern | null = null;

/** Draw blind-spot overlay using precomputed visibility polygons */
function drawBlindSpots(
  ctx: CanvasRenderingContext2D,
  visPols: [number, number][][],
  walls: WallSegment[],
  pan:{x:number;y:number}, zoom:number, W:number, H:number,
) {
  if (!visPols.length || !walls.length) return;

  // 1. Calculate bounding box of all walls
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  walls.forEach(w => {
    minX = Math.min(minX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2);
    maxY = Math.max(maxY, w.y1, w.y2);
  });
  
  // Add some padding around the walls so we don't bleed out forever, but cover the room
  minX -= 0.5; minY -= 0.5; maxX += 0.5; maxY += 0.5;

  const pMin = toCanvas(minX, minY, pan, zoom, W, H);
  const pMax = toCanvas(maxX, maxY, pan, zoom, W, H);
  
  const startX = Math.max(0, pMin.x);
  const startY = Math.max(0, pMin.y);
  const endX = Math.min(W, pMax.x);
  const endY = Math.min(H, pMax.y);

  // 2. Generate a highlighted striped pattern (cached for performance)
  if (!blindSpotPattern) {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 24;
    patternCanvas.height = 24;
    const pctx = patternCanvas.getContext('2d')!;
    // Semi-transparent red background
    pctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    pctx.fillRect(0, 0, 24, 24);
    // Stronger diagonal stripes
    pctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    pctx.lineWidth = 2.5;
    pctx.beginPath();
    pctx.moveTo(0, 24); pctx.lineTo(24, 0);
    pctx.moveTo(-12, 12); pctx.lineTo(12, -12);
    pctx.moveTo(12, 36); pctx.lineTo(36, 12);
    pctx.stroke();
    blindSpotPattern = ctx.createPattern(patternCanvas, 'repeat');
  }

  // 3. Fill the grid with the pattern where cameras can't see, ONLY inside the building
  const cell = 12; // grid resolution
  ctx.fillStyle = blindSpotPattern || 'rgba(239,68,68,0.4)';
  
  for (let cy = startY; cy < endY; cy += cell) {
    for (let cx = startX; cx < endX; cx += cell) {
      const { x: wx, y: wy } = toWorld(cx + cell/2, cy + cell/2, pan, zoom, W, H);
      
      // Do not draw blind spots inside the walls themselves
      let insideWall = false;
      for (const w of walls) {
        const l2 = (w.x2 - w.x1)**2 + (w.y2 - w.y1)**2;
        let dist = 0;
        if (l2 === 0) dist = Math.hypot(wx - w.x1, wy - w.y1);
        else {
          let t = ((wx - w.x1) * (w.x2 - w.x1) + (wy - w.y1) * (w.y2 - w.y1)) / l2;
          t = Math.max(0, Math.min(1, t));
          dist = Math.hypot(wx - (w.x1 + t * (w.x2 - w.x1)), wy - (w.y1 + t * (w.y2 - w.y1)));
        }
        if (dist <= (w.thickness ?? 0.2) / 2 + 0.02) { insideWall = true; break; }
      }
      if (insideWall) continue;

      // Heuristic: A point is inside the building if rays cast in 8 directions hit a wall in at least 5 directions.
      let wallHits = 0;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        if (rayHitWalls(wx, wy, Math.cos(a), Math.sin(a), walls, 9999) < 9999) wallHits++;
      }
      
      if (wallHits >= 5 && !visPols.some(poly => pointInPoly(wx, wy, poly))) {
        ctx.fillRect(cx, cy, cell, cell);
      }
    }
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: { id: Tool; icon: string; label: string; key: string; desc: string }[] = [
  { id: 'select',    icon: '↖',  label: 'Selecionar', key: 'V', desc: 'Selecionar e mover' },
  { id: 'scale',     icon: '📏', label: 'Escala',     key: 'S', desc: 'Definir escala métrica da planta' },
  { id: 'wall',      icon: '▬',  label: 'Parede',     key: 'W', desc: 'Desenhar paredes' },
  { id: 'camera',    icon: '📷', label: 'Câmera',     key: 'C', desc: 'Adicionar câmera' },
  { id: 'furniture', icon: '🛋', label: 'Mobília',    key: 'F', desc: 'Adicionar mobília' },
  { id: 'erase',     icon: '✕',  label: 'Apagar',     key: 'E', desc: 'Remover elemento' },
];

// ══════════════════════════════════════════════════════════════════════════════
// FloorPlanEditor – main component
// ══════════════════════════════════════════════════════════════════════════════
const FloorPlanEditor: React.FC = () => {
  const {
    floorPlanImage, setFloorPlanImage,
    walls, addWall, updateWall, removeWall,
    sceneObjects, addSceneObject, updateSceneObject, removeSceneObject,
    selectedSceneObjectId, setSelectedSceneObjectId,
    selectedWallId, setSelectedWallId,
  } = useProjectStore();

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef       = useRef<{mx:number;my:number;px:number;py:number}|null>(null);
  const dragRef      = useRef<{id:string;kind:'cam'|'furn'|'wall1'|'wall2'|'wall-move';ox:number;oy:number;swx:number;swy:number;ox2?:number;oy2?:number}|null>(null);

  const [viewMode,      setViewMode]      = useState<ViewMode>('2d');
  const [tool,          setTool]          = useState<Tool>('select');
  const [zoom,          setZoom]          = useState(1.0);
  const [pan,           setPan]           = useState({ x: 0, y: 0 });
  const [mouseWorld,    setMouseWorld]    = useState({ x: 0, y: 0 });
  const [canvasSize,    setCanvasSize]    = useState({ w: 800, h: 600 });
  const [wallStart,     setWallStart]     = useState<{x:number;y:number}|null>(null);
  const [wallThickness, setWallThickness] = useState(0.2);
  const [wallHeight,    setWallHeight]    = useState(2.8);
  const [showBlinds,    setShowBlinds]    = useState(true);
  const [showDoriLegend,setShowDoriLegend]= useState(true);
  const [showCalculator,setShowCalculator]= useState(false);
  const [hoveredWallId, setHoveredWallId] = useState<string|null>(null);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [showFurnPicker, setShowFurnPicker] = useState(false);
  const [pendingPos,     setPendingPos]     = useState<{x:number;y:number;r?:number}|null>(null);
  const [showHeatmap,    setShowHeatmap]    = useState(false);
  const [showReport,     setShowReport]    = useState(false);
  const [isConverting,   setIsConverting]  = useState(false);
  const [imgEl,          setImgEl]         = useState<HTMLImageElement | null>(null);
  const [floorPlanScale, setFloorPlanScale] = useState(1.0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ── Scale tool states
  const [scaleLineStart, setScaleLineStart] = useState<{cx:number;cy:number;wx:number;wy:number}|null>(null);
  const [scaleLineEnd,   setScaleLineEnd]   = useState<{cx:number;cy:number;wx:number;wy:number}|null>(null);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scaleInput,     setScaleInput]     = useState('5');

  // ── SVG Parsing states
  const [svgDoc, setSvgDoc] = useState<Document | null>(null);
  const [svgLayers, setSvgLayers] = useState<{id: string; name: string; count: number; color?: string}[]>([]);
  const [showLayerModal, setShowLayerModal] = useState(false);

  useEffect(() => {
    if (!floorPlanImage) { setImgEl(null); return; }
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      // Pega o tamanho real da tela do usuário
      const cw = containerRef.current?.clientWidth || 1200;
      const ch = containerRef.current?.clientHeight || 800;
      // Calcula o scale para a imagem preencher quase toda a tela
      const bestScale = Math.min(cw / img.width, ch / img.height) * 0.95;
      setFloorPlanScale(Math.max(0.1, Math.min(20, bestScale)));
    };
    img.src = floorPlanImage;
  }, [floorPlanImage]);

  const handleFile = useCallback(async (file: File) => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      setIsConverting(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          useProjectStore.setState({ walls: [], sceneObjects: [], selectedSceneObjectId: null, selectedWallId: null });
          setFloorPlanImage(canvas.toDataURL('image/png'));
        }
      } catch (err) {
        console.error("Erro ao carregar PDF:", err);
        alert("Ocorreu um erro ao renderizar o PDF.");
      }
      setIsConverting(false);
    } 
    else if (fileName.endsWith('.dwg')) {
      alert("Importação de arquivos .DWG não está disponível nesta versão do site. Exporte sua planta do AutoCAD/similar como PDF, PNG ou JPG e importe novamente aqui.");
    }
    else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        useProjectStore.setState({ walls: [], sceneObjects: [], selectedSceneObjectId: null, selectedWallId: null });
        setFloorPlanImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert("Formato não suportado. Envie uma Imagem, PDF ou DWG.");
    }
  }, [setFloorPlanImage]);

  // Função para importar paredes de uma camada específica do SVG
  const importSvgLayerAsWalls = (layerId: string) => {
    if (!svgDoc || !imgEl) return;
    
    // Como a nova lógica agrupa as linhas sem usar apenas <g id>, vamos filtrar todas as linhas de novo
    const allPaths = Array.from(svgDoc.querySelectorAll('line, path, polyline'));
    const targetLines = allPaths.filter(p => {
       const parent = p.closest('g[id], g[class]');
       let name = "Camada Padrão";
       if (parent) {
          name = parent.getAttribute('id') || parent.getAttribute('class') || name;
       } else {
          const stroke = p.getAttribute('stroke');
          if (stroke) name = `Linhas (Cor ${stroke})`;
       }
       return name === layerId;
    });

    if (targetLines.length === 0) return;

    // SVG coordinates might use a different viewBox or raw width/height
    const svgW = parseFloat(svgDoc.documentElement.getAttribute('width') || String(imgEl.width));
    const svgH = parseFloat(svgDoc.documentElement.getAttribute('height') || String(imgEl.height));
    
    // We assume the SVG is drawn to match the PNG output dimensions directly.
    const scaleX = imgEl.width / svgW;
    const scaleY = imgEl.height / svgH;

    const parseCoordinate = (val: string | null) => parseFloat(val || '0');

    const newWalls: WallSegment[] = [];

    const pushWall = (x1: number, y1: number, x2: number, y2: number) => {
      const wx1 = (x1 - imgEl.width / 2) * floorPlanScale / getPPM();
      const wy1 = (y1 - imgEl.height / 2) * floorPlanScale / getPPM();
      const wx2 = (x2 - imgEl.width / 2) * floorPlanScale / getPPM();
      const wy2 = (y2 - imgEl.height / 2) * floorPlanScale / getPPM();
      
      // Ignorar linhas muito pequenas (menores que 10cm) para não pesar o 3D
      const dist = Math.hypot(wx2 - wx1, wy2 - wy1);
      if (dist < 0.1) return;

      newWalls.push({
        id: uuidv4(),
        x1: wx1, y1: wy1,
        x2: wx2, y2: wy2,
        thickness: 0.15,
        height: 2.8,
        color: '#475569'
      });
    };
    
    // Convert elements
    targetLines.forEach(line => {
      const tag = line.tagName.toLowerCase();
      
      if (tag === 'line') {
        const x1 = parseCoordinate(line.getAttribute('x1')) * scaleX;
        const y1 = parseCoordinate(line.getAttribute('y1')) * scaleY;
        const x2 = parseCoordinate(line.getAttribute('x2')) * scaleX;
        const y2 = parseCoordinate(line.getAttribute('y2')) * scaleY;
        pushWall(x1, y1, x2, y2);
      }
      else if (tag === 'polyline' || tag === 'polygon') {
        const pointsStr = line.getAttribute('points');
        if (!pointsStr) return;
        const pts = pointsStr.trim().split(/[\s,]+/).filter(s => s).map(parseCoordinate);
        for (let i = 0; i < pts.length - 3; i += 2) {
          pushWall(pts[i] * scaleX, pts[i+1] * scaleY, pts[i+2] * scaleX, pts[i+3] * scaleY);
        }
        if (tag === 'polygon' && pts.length >= 4) {
          pushWall(pts[pts.length-2] * scaleX, pts[pts.length-1] * scaleY, pts[0] * scaleX, pts[1] * scaleY);
        }
      }
      else if (tag === 'path') {
        const d = line.getAttribute('d');
        if (!d) return;
        const commands = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi);
        if (!commands) return;
        
        let cx = 0, cy = 0;
        let startX = 0, startY = 0;
        
        commands.forEach(cmdStr => {
           const cmd = cmdStr[0];
           const args = cmdStr.slice(1).trim().split(/[\s,]+/).filter(s => s).map(parseCoordinate);
           if (cmd.toUpperCase() === 'M' && args.length >= 2) {
              cx = args[0]; cy = args[1];
              startX = cx; startY = cy;
           } else if (cmd.toUpperCase() === 'L' && args.length >= 2) {
              const nx = args[0], ny = args[1];
              pushWall(cx * scaleX, cy * scaleY, nx * scaleX, ny * scaleY);
              cx = nx; cy = ny;
           } else if (cmd.toUpperCase() === 'H' && args.length >= 1) {
              const nx = args[0];
              pushWall(cx * scaleX, cy * scaleY, nx * scaleX, cy * scaleY);
              cx = nx;
           } else if (cmd.toUpperCase() === 'V' && args.length >= 1) {
              const ny = args[0];
              pushWall(cx * scaleX, cy * scaleY, cx * scaleX, ny * scaleY);
              cy = ny;
           } else if (cmd.toUpperCase() === 'Z') {
              pushWall(cx * scaleX, cy * scaleY, startX * scaleX, startY * scaleY);
           }
        });
      }
    });

    // Add them to the state
    useProjectStore.setState(prev => ({
      walls: [...prev.walls, ...newWalls]
    }));

    setShowLayerModal(false);
    alert(`${newWalls.length} paredes importadas com sucesso!`);
  };

  const cameras  = useMemo(() => sceneObjects.filter(o => o.type === 'camera'),  [sceneObjects]);
  const furniture = useMemo(() => sceneObjects.filter(o => o.type !== 'camera'), [sceneObjects]);
  const selectedWall = walls.find(w => w.id === selectedWallId) ?? null;
  const selectedObj  = sceneObjects.find(o => o.id === selectedSceneObjectId) ?? null;

  // ── Precompute visibility polygons (wall-clipped FOV) for all cameras ────────
  const visPolygons = useMemo(() => {
    const doorWalls: WallSegment[] = furniture.filter(f => DOOR_TYPES.has(f.type)).map(d => {
      const [bw] = FURNITURE_SIZES[d.type] ?? [0.9, 0.15];
      const w = bw * d.scale[0];
      const r = d.rotation[1];
      const dx = Math.cos(r) * (w / 2);
      const dy = Math.sin(r) * (w / 2);
      return {
        id: 'door_' + d.id,
        x1: d.position[0] - dx,
        y1: d.position[2] - dy,
        x2: d.position[0] + dx,
        y2: d.position[2] + dy,
        thickness: 0.1, height: 2.1, color: '#000'
      };
    });
    const allWalls = [...walls, ...doorWalls];

    return cameras.map(cam => computeVisibilityPoly(
      cam.position[0], cam.position[2],
      r1ToCanvas(cam.rotation[1]),
      Math.min(Math.max(cam.fov ?? 75, 1), 360) / 2 * Math.PI / 180,
      cam.range ?? 10,
      allWalls,
    ));
  }, [cameras, walls, furniture]);

  // ── LPR (license-plate legibility) polygons – identify-zone only, LPR-capable cams ──
  const lprCameras = useMemo(() => cameras.filter(c => (c.model ?? '').toUpperCase().includes('LPR')), [cameras]);
  const lprPolygons = useMemo(() => {
    const doorWalls: WallSegment[] = furniture.filter(f => DOOR_TYPES.has(f.type)).map(d => {
      const [bw] = FURNITURE_SIZES[d.type] ?? [0.9, 0.15];
      const w = bw * d.scale[0];
      const r = d.rotation[1];
      const dx = Math.cos(r) * (w / 2);
      const dy = Math.sin(r) * (w / 2);
      return { id: 'door_' + d.id, x1: d.position[0]-dx, y1: d.position[2]-dy, x2: d.position[0]+dx, y2: d.position[2]+dy, thickness:0.1, height:2.1, color:'#000' };
    });
    const allWalls = [...walls, ...doorWalls];
    return lprCameras.map(cam => {
      const f = cam.focalLength ?? 2.8;
      const sw = cam.sensorWidth ?? 5.27;
      const rw = parseInt((cam.resolution ?? '1920x1080').split('x')[0]) || 1920;
      const identifyRange = Math.min(cam.range ?? 30, calculateDORIZones(rw, f, sw).identify);
      return computeVisibilityPoly(
        cam.position[0], cam.position[2],
        r1ToCanvas(cam.rotation[1]),
        Math.min(Math.max(cam.fov ?? 55, 1), 360) / 2 * Math.PI / 180,
        identifyRange,
        allWalls,
      );
    });
  }, [lprCameras, walls, furniture]);

  // ── Coverage % (accurate, uses visibility polygons) ──────────────────────────
  const coveragePct = useMemo(() => {
    if (!cameras.length || !walls.length) return null;
    const xs = walls.flatMap(w => [w.x1, w.x2]);
    const ys = walls.flatMap(w => [w.y1, w.y2]);
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
    let total = 0, covered = 0;
    const step = 0.5;
    for (let x = minX; x < maxX; x += step) {
      for (let y = minY; y < maxY; y += step) {
        let wallHits = 0;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          if (rayHitWalls(x, y, Math.cos(a), Math.sin(a), walls, 9999) < 9999) wallHits++;
        }
        // Only count area INSIDE the building
        if (wallHits >= 5) {
          total++;
          if (visPolygons.some(poly => pointInPoly(x, y, poly))) covered++;
        }
      }
    }
    return total > 0 ? Math.round(covered / total * 100) : 0;
  }, [visPolygons, walls, cameras]);

  // ── Resize observer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: width, h: height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Main canvas render ────────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== '2d') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w: W, h: H } = canvasSize;
    canvas.width = W; canvas.height = H;

    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);
    drawGrid(ctx, pan, zoom, W, H);

    if (imgEl) {
      const p = toCanvas(0, 0, pan, zoom, W, H);
      // Aqui usamos o floorPlanScale para permitir que o usuário ajuste o tamanho
      const w = imgEl.width * zoom * floorPlanScale; 
      const h = imgEl.height * zoom * floorPlanScale;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(imgEl, p.x - w/2, p.y - h/2, w, h);
      ctx.globalAlpha = 1.0;
    }

    // ── Blind spots (wall-aware, polygon-based) ─────────────────────────────
    if (showBlinds) drawBlindSpots(ctx, visPolygons, walls, pan, zoom, W, H);

    // ── Heat Map (coverage density) ──────────────────────────────────────────
    if (showHeatmap && cameras.length > 0 && walls.length > 0) {
      const step = 0.5;
      const xs = walls.flatMap(w => [w.x1, w.x2]);
      const ys = walls.flatMap(w => [w.y1, w.y2]);
      const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
      const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
      const cellPx = step * getPPM() * zoom;
      ctx.save();
      for (let x = minX; x < maxX; x += step) {
        for (let y = minY; y < maxY; y += step) {
          // Check inside building
          let wallHits = 0;
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            if (rayHitWalls(x, y, Math.cos(a), Math.sin(a), walls, 9999) < 9999) wallHits++;
          }
          if (wallHits < 5) continue;
          // Count how many cameras cover this point
          const count = visPolygons.filter(poly => pointInPoly(x, y, poly)).length;
          if (count === 0) {
            ctx.fillStyle = 'rgba(239,68,68,0.28)'; // red – no coverage
          } else if (count === 1) {
            ctx.fillStyle = 'rgba(234,179,8,0.30)';  // yellow – single cam
          } else {
            ctx.fillStyle = 'rgba(34,197,94,0.32)';  // green – multiple cams
          }
          const p = toCanvas(x, y, pan, zoom, W, H);
          ctx.fillRect(p.x, p.y, cellPx + 1, cellPx + 1);
        }
      }
      ctx.restore();
    }

    // ── FOV polygons (clipped by walls) ─────────────────────────────────────
    for (let i = 0; i < cameras.length; i++) {
      const obj = cameras[i];
      const poly = visPolygons[i];
      if (poly.length > 0) {
        drawFOVPoly(ctx, poly, obj.color ?? '#3b82f6', obj.range ?? 10, pan, zoom, W, H, obj);
      }
    }

    // ── Walls ────────────────────────────────────────────────────────────────
    for (const wall of walls) {
      drawWall(ctx, wall, pan, zoom, W, H, wall.id === selectedWallId, wall.id === hoveredWallId);
    }
    
    // ── Wall Handles ─────────────────────────────────────────────────────────
    if (selectedWallId) {
      const w = walls.find(w => w.id === selectedWallId);
      if (w) {
        const p1 = toCanvas(w.x1, w.y1, pan, zoom, W, H);
        const p2 = toCanvas(w.x2, w.y2, pan, zoom, W, H);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p1.x, p1.y, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(p2.x, p2.y, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
    }

    if (tool === 'wall' && wallStart) {
      drawWallPreview(ctx, wallStart.x, wallStart.y, snap(mouseWorld.x), snap(mouseWorld.y), wallThickness, pan, zoom, W, H);
    }

    // ── Area Labels ─────────────────────────────────────────────────────────
    const labels = [
      { text: 'RECEPÇÃO', x: -8, y: 5 },
      { text: 'SALA DE REUNIÕES', x: 8, y: 5 },
      { text: 'DATA CENTER', x: 9, y: -5 },
      { text: 'ÁREA DE TRABALHO', x: -3, y: -5 },
    ];
    
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const label of labels) {
      const p = toCanvas(label.x, label.y, pan, zoom, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const textMetrics = ctx.measureText(label.text);
      const bgWidth = textMetrics.width + 16;
      const bgHeight = 20;
      ctx.beginPath();
      ctx.roundRect(p.x - bgWidth/2, p.y - bgHeight/2, bgWidth, bgHeight, 6);
      ctx.fill();
      ctx.fillStyle = '#0F62FE';
      ctx.fillText(label.text, p.x, p.y);
    }

    // ── Furniture ────────────────────────────────────────────────────────────
    // ── Furniture (non-person, non-car) ──────────────────────────────────────
    for (const obj of furniture.filter(o => o.type !== 'person' && o.type !== 'car')) {
      drawFurniture(ctx, obj, obj.id === selectedSceneObjectId, pan, zoom, W, H);
    }

    // ── Persons with visibility indicators ──────────────────────────────────
    for (const obj of furniture.filter(o => o.type === 'person')) {
      const isDetected = visPolygons.some(poly => pointInPoly(obj.position[0], obj.position[2], poly));
      drawPerson(ctx, obj, obj.id === selectedSceneObjectId, isDetected, pan, zoom, W, H);
    }

    // ── Cars with LPR plate-read indicator ───────────────────────────────────
    for (const obj of furniture.filter(o => o.type === 'car')) {
      const isPlateRead = lprPolygons.some(poly => pointInPoly(obj.position[0], obj.position[2], poly));
      drawCar(ctx, obj, obj.id === selectedSceneObjectId, isPlateRead, pan, zoom, W, H);
    }

    // ── Cameras ──────────────────────────────────────────────────────────────
    for (const cam of cameras) {
      const short = (cam.model ?? 'CAM').replace('Illustra ', '').split(' ')[0];
      drawCamera(ctx, cam, short, cam.id === selectedSceneObjectId, pan, zoom, W, H);
    }

    // ── Snap indicator ────────────────────────────────────────────────────────
    if (tool !== 'select' && tool !== 'erase' && tool !== 'scale') {
      const sp = toCanvas(snap(mouseWorld.x), snap(mouseWorld.y), pan, zoom, W, H);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb'; ctx.fill();
    }
    if (tool === 'wall') {
      const sp = toCanvas(snap(mouseWorld.x), snap(mouseWorld.y), pan, zoom, W, H);
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(sp.x-14, sp.y); ctx.lineTo(sp.x+14, sp.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y-14); ctx.lineTo(sp.x, sp.y+14); ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Scale Tool Drawing ────────────────────────────────────────────────────
    if (tool === 'scale') {
      if (scaleLineStart) {
        const p1 = toCanvas(scaleLineStart.wx, scaleLineStart.wy, pan, zoom, W, H);
        const p2 = scaleLineEnd ? toCanvas(scaleLineEnd.wx, scaleLineEnd.wy, pan, zoom, W, H) : toCanvas(mouseWorld.x, mouseWorld.y, pan, zoom, W, H);
        
        ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#047857'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p1.x, p1.y, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(p2.x, p2.y, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
    }

    // ── Scale bar ─────────────────────────────────────────────────────────────
    const scaleW = 5 * getPPM() * zoom;
    const sbX = 20, sbY = H - 22;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sbX, sbY+6, scaleW, 3);
    ctx.fillRect(sbX, sbY+3, 2, 9); ctx.fillRect(sbX+scaleW-2, sbY+3, 2, 9);
    ctx.fillStyle = '#64748b'; ctx.font = '10px Inter,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('5m', sbX + scaleW/2, sbY+2);
  }, [walls, sceneObjects, pan, zoom, canvasSize, wallStart, mouseWorld, tool, wallThickness,
      selectedWallId, selectedSceneObjectId, hoveredWallId, showBlinds, showHeatmap, visPolygons, lprPolygons, cameras, furniture, viewMode]);

  // ── Hit tests ─────────────────────────────────────────────────────────────────
  const hitWall = useCallback((wx:number, wy:number): string|null => {
    for (const wall of [...walls].reverse()) {
      const dx = wall.x2-wall.x1, dy = wall.y2-wall.y1;
      const len2 = dx*dx + dy*dy; if (len2 < 0.001) continue;
      const t = ((wx-wall.x1)*dx + (wy-wall.y1)*dy) / len2;
      if (t < 0 || t > 1) continue;
      const fx = wall.x1+t*dx, fy = wall.y1+t*dy;
      const nx = -dy/Math.sqrt(len2), ny = dx/Math.sqrt(len2);
      if (Math.abs((wx-fx)*nx + (wy-fy)*ny) < wall.thickness/2+0.15) return wall.id;
    }
    return null;
  }, [walls]);

  const hitWallEndpoint = useCallback((wx: number, wy: number): 'p1' | 'p2' | null => {
    if (!selectedWallId) return null;
    const w = walls.find(w => w.id === selectedWallId);
    if (!w) return null;
    if (Math.hypot(wx - w.x1, wy - w.y1) < 0.4) return 'p1';
    if (Math.hypot(wx - w.x2, wy - w.y2) < 0.4) return 'p2';
    return null;
  }, [walls, selectedWallId]);

  const hitCamera = useCallback((wx:number, wy:number): string|null => {
    for (const cam of [...cameras].reverse()) {
      if (Math.hypot(wx-cam.position[0], wy-cam.position[2]) < 1.5) return cam.id;
    }
    return null;
  }, [cameras]);

  const hitFurniture = useCallback((wx:number, wy:number): string|null => {
    for (const obj of [...furniture].reverse()) {
      const [bw, bhRaw] = FURNITURE_SIZES[obj.type] ?? [1,1];
      const bh = obj.type === 'door' ? bw : bhRaw; // Make hitbox square for the door arc
      const hw = bw*obj.scale[0]/2+0.12, hh = bh*obj.scale[2]/2+0.12;
      const r = -obj.rotation[1];
      const dx = wx-obj.position[0], dy = wy-obj.position[2];
      const lx = dx*Math.cos(r)-dy*Math.sin(r);
      const ly = dx*Math.sin(r)+dy*Math.cos(r);
      
      if (obj.type === 'door') {
         // Custom hit detection offset for door because its arc is drawn extending upwards
         if (lx > -hw-0.5 && lx < hw+0.5 && ly > -hw*2 && ly < 0.2) return obj.id;
      } else {
         if (Math.abs(lx)<hw && Math.abs(ly)<hh) return obj.id;
      }
    }
    return null;
  }, [furniture]);

  // ── Mouse events ───────────────────────────────────────────────────────────────
  const getW = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return toWorld(e.clientX-r.left, e.clientY-r.top, pan, zoom, canvasSize.w, canvasSize.h);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button===1 || (e.button===0 && e.altKey)) {
      panRef.current = { mx:e.clientX, my:e.clientY, px:pan.x, py:pan.y }; return;
    }
    if (e.button !== 0) return;
    const { x:wx, y:wy } = getW(e);
    const sx = snap(wx), sy = snap(wy);

    if (tool === 'select') {
      const camId = hitCamera(wx, wy);
      if (camId) {
        setSelectedSceneObjectId(camId); setSelectedWallId(null);
        const cam = cameras.find(c => c.id===camId)!;
        dragRef.current = { id:camId, kind:'cam', ox:cam.position[0], oy:cam.position[2], swx:wx, swy:wy };
        return;
      }
      const furnId = hitFurniture(wx, wy);
      if (furnId) {
        setSelectedSceneObjectId(furnId); setSelectedWallId(null);
        const f = furniture.find(o => o.id===furnId)!;
        dragRef.current = { id:furnId, kind:'furn', ox:f.position[0], oy:f.position[2], swx:wx, swy:wy };
        return;
      }
      if (selectedWallId) {
        const ep = hitWallEndpoint(wx, wy);
        const w = walls.find(w => w.id === selectedWallId);
        if (ep === 'p1' && w) {
          dragRef.current = { id: selectedWallId, kind: 'wall1', ox: w.x1, oy: w.y1, swx: wx, swy: wy };
          return;
        }
        if (ep === 'p2' && w) {
          dragRef.current = { id: selectedWallId, kind: 'wall2', ox: w.x2, oy: w.y2, swx: wx, swy: wy };
          return;
        }
      }
      const wallId = hitWall(wx, wy);
      setSelectedWallId(wallId ?? null); setSelectedSceneObjectId(null);
      if (wallId) {
        const w = walls.find(w => w.id === wallId)!;
        dragRef.current = { id: wallId, kind: 'wall-move', ox: w.x1, oy: w.y1, swx: wx, swy: wy, ox2: w.x2, oy2: w.y2 };
      }

    } else if (tool === 'scale') {
      if (!scaleLineStart) {
        setScaleLineStart({ cx: e.clientX, cy: e.clientY, wx, wy });
      } else if (!scaleLineEnd) {
        setScaleLineEnd({ cx: e.clientX, cy: e.clientY, wx, wy });
        setShowScaleModal(true);
      }
    } else if (tool === 'wall') {
      if (!wallStart) { setWallStart({ x:sx, y:sy }); }
      else {
        if (Math.hypot(sx-wallStart.x, sy-wallStart.y) > 0.01) {
          addWall({ id:uuidv4(), x1:wallStart.x, y1:wallStart.y, x2:sx, y2:sy, thickness:wallThickness, height:wallHeight, color:'#374151' });
          setWallStart({ x:sx, y:sy });
        }
      }
    } else if (tool === 'camera' || tool === 'furniture') {
      let finalPos = { x: sx, y: sy, r: 0 };
      
      let closestDist = 0.5;
      for (const wall of walls) {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const len2 = dx*dx + dy*dy;
        if (len2 < 0.001) continue;
        
        let t = ((wx - wall.x1)*dx + (wy - wall.y1)*dy) / len2;
        t = Math.max(0, Math.min(1, t));
        
        const px = wall.x1 + t*dx;
        const py = wall.y1 + t*dy;
        
        const dist = Math.hypot(wx - px, wy - py);
        if (dist < closestDist) {
          closestDist = dist;
          const nx = -dy, ny = dx;
          const dot = (wx - px)*nx + (wy - py)*ny;
          let angle = Math.atan2(ny, nx);
          if (dot < 0) angle += Math.PI;
          
          finalPos = { 
            x: px + Math.cos(angle)*0.08, 
            y: py + Math.sin(angle)*0.08, 
            r: -angle - Math.PI/2 
          };
        }
      }
      
      setPendingPos(finalPos);
      if (tool === 'camera') setShowCamPicker(true);
      else setShowFurnPicker(true);
    } else if (tool === 'erase') {
      const camId = hitCamera(wx, wy);
      if (camId) { removeSceneObject(camId); return; }
      const furnId = hitFurniture(wx, wy);
      if (furnId) { removeSceneObject(furnId); return; }
      const wallId = hitWall(wx, wy);
      if (wallId) removeWall(wallId);
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x:wx, y:wy } = getW(e);
    setMouseWorld({ x:wx, y:wy });
    if (panRef.current) {
      setPan({ x:panRef.current.px+e.clientX-panRef.current.mx, y:panRef.current.py+e.clientY-panRef.current.my });
    }
    if (dragRef.current && tool==='select') {
      const dx = wx-dragRef.current.swx, dy = wy-dragRef.current.swy;
      const kind = dragRef.current.kind;
      if (kind === 'cam' || kind === 'furn') {
        const nx = snap(dragRef.current.ox+dx), ny = snap(dragRef.current.oy+dy);
        updateSceneObject(dragRef.current.id, { position:[nx, kind==='cam'?2.8:0, ny] });
      } else if (kind === 'wall1') {
        const nx = snap(dragRef.current.ox+dx), ny = snap(dragRef.current.oy+dy);
        updateWall(dragRef.current.id, { x1: nx, y1: ny });
      } else if (kind === 'wall2') {
        const nx = snap(dragRef.current.ox+dx), ny = snap(dragRef.current.oy+dy);
        updateWall(dragRef.current.id, { x2: nx, y2: ny });
      } else if (kind === 'wall-move') {
        const nx1 = snap(dragRef.current.ox+dx), ny1 = snap(dragRef.current.oy+dy);
        const nx2 = snap(dragRef.current.ox2!+dx), ny2 = snap(dragRef.current.oy2!+dy);
        updateWall(dragRef.current.id, { x1: nx1, y1: ny1, x2: nx2, y2: ny2 });
      }
    }
    if (tool==='select') setHoveredWallId(hitWall(wx, wy));
  };

  const onMouseUp = () => { panRef.current=null; dragRef.current=null; };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom(z => Math.max(0.15, Math.min(6, z*(e.deltaY<0?1.12:0.9))));
  };
  const onRightClick = (e: React.MouseEvent) => { e.preventDefault(); setWallStart(null); };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key==='Escape') { setWallStart(null); setScaleLineStart(null); setScaleLineEnd(null); setShowScaleModal(false); setTool('select'); }
      if ((e.key==='Delete'||e.key==='Backspace') && !showCamPicker && !showFurnPicker && !showScaleModal) {
        if (selectedWallId) { removeWall(selectedWallId); setSelectedWallId(null); }
        if (selectedSceneObjectId) { removeSceneObject(selectedSceneObjectId); setSelectedSceneObjectId(null); }
      }
      if (!e.ctrlKey && !e.metaKey && !showScaleModal) {
        if (e.key==='v'||e.key==='V') setTool('select');
        if (e.key==='s'||e.key==='S') setTool('scale');
        if (e.key==='w'||e.key==='W') { setTool('wall'); setSelectedWallId(null); setSelectedSceneObjectId(null); }
        if (e.key==='c'||e.key==='C') setTool('camera');
        if (e.key==='f'||e.key==='F') setTool('furniture');
        if (e.key==='e'||e.key==='E') setTool('erase');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedWallId, selectedSceneObjectId, showCamPicker, showFurnPicker, removeWall, removeSceneObject, setSelectedSceneObjectId]);

  // ── Camera model picker ────────────────────────────────────────────────────────
  const addCamera = (model: typeof CAMERA_CATALOG[0]) => {
    if (!pendingPos) return;
    addSceneObject({
      id:uuidv4(), type:'camera',
      position:[pendingPos.x, 2.8, pendingPos.y],
      rotation:[0, pendingPos.r || 0, 0], scale:[1,1,1],
      color: CAM_COLORS[model.model] ?? '#0ea5e9',
      focalLength: 2.8,
      sensorWidth: 5.27, // 1/2.8" sensor width in mm
      resolution: /^\d+x\d+$/.test(model.resolution as any) ? model.resolution : "1920x1080",
      fov: model.doriAngle,
      range: Math.max(5, Math.round(model.doriRadius / 12)),
      model: model.model,
      tilt: model.model.toUpperCase().includes('LPR') ? 8 : 15,
    } as any);
    setShowCamPicker(false); setPendingPos(null); setTool('select');
  };

  // ── Furniture picker ────────────────────────────────────────────────────────
  const FURN_ITEMS = [
    { type:'table',  icon:'🪵', label:'Mesa',    color:'#fef3c7' },
    { type:'chair',  icon:'🪑', label:'Cadeira', color:'#ede9fe' },
    { type:'sofa',   icon:'🛋️', label:'Sofá',   color:'#fce7e7' },
    { type:'bed',    icon:'🛏️', label:'Cama',   color:'#dbeafe' },
    { type:'column', icon:'⬤',  label:'Coluna', color:'#e5e7eb' },
    { type:'rack',   icon:'🗄️', label:'Rack 19"', color:'#111827' },
    { type:'person', icon:'🧍', label:'Pessoa', color:'#ffb6c1' },
    { type:'car',    icon:'🚗', label:'Carro',  color:'#94a3b8' },
    { type:'reader', icon:'🪪', label:'Leitora', color:'#10b981' },
    { type:'controller', icon:'🎛️', label:'Controladora', color:'#f59e0b' },
    { type:'door',        icon:'🚪', label:'Porta Simples',  color:'#78350f' },
    { type:'door_heavy',  icon:'🛡️', label:'Porta Pesada',   color:'#334155' },
    { type:'door_sliding',icon:'↔️', label:'Porta Corrediça', color:'#0e7490' },
    { type:'door_auto',   icon:'⚙️', label:'Porta Automática', color:'#7c3aed' },
  ];
  const addFurniture = (type: string, color: string) => {
    if (!pendingPos) return;
    let yHeight = 0;
    if (type === 'reader') yHeight = 1.2;
    if (type === 'controller') yHeight = 1.8;
    const extra = type === 'car' ? { plate: generatePlate() } : {};
    addSceneObject({ id:uuidv4(), type:type as any, position:[pendingPos.x, yHeight, pendingPos.y], rotation:[0, pendingPos.r || 0, 0], scale:[1,1,1], color, ...extra });
    setShowFurnPicker(false); setPendingPos(null); setTool('select');
  };

  const getCursor = () => {
    if (panRef.current) return 'grabbing';
    if (dragRef.current) return 'move';
    if (tool==='erase') return 'not-allowed';
    if (tool==='wall')  return 'crosshair';
    if (tool==='select') return hoveredWallId ? 'pointer' : 'default';
    return 'crosshair';
  };

  const fmtBearing = (r1: number) => ((-r1*180/Math.PI)+360)%360;
  const bearingToR1 = (deg: number) => -deg*Math.PI/180;

  // ── Style helpers ─────────────────────────────────────────────────────────────
  const S = {
    sideBar: { background:'#0f172a', display:'flex', flexDirection:'column' as const, flexShrink:0 },
    toolBtn: {
      width:52, height:52, borderRadius:12,
      display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', gap:2,
      cursor:'pointer', transition:'all 0.15s', fontSize:16, border: '1.5px solid transparent'
    },
    btnView: (active:boolean): React.CSSProperties => ({
      padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
      background: active ? '#2563eb' : 'transparent',
      color: active ? '#fff' : '#475569',
      border: active ? '1px solid #3b82f6' : '1px solid #334155',
      transition:'all 0.15s',
    }),
    panel: { width:268, background:'#0f172a', borderLeft:'1px solid #1e293b', overflowY:'auto' as const, flexShrink:0 },
    section: { padding:'14px 16px', borderBottom:'1px solid #1e293b' },
    sTitle: { fontSize:10, fontWeight:700, color:'#475569', letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:12 },
    lbl: { fontSize:11, color:'#64748b', marginBottom:4, display:'flex', justifyContent:'space-between' as const, alignItems:'center' as const },
    val: { fontSize:11, fontWeight:700, color:'#38bdf8' },
    slider: { width:'100%', accentColor:'#2563eb', cursor:'pointer' },
    field: { background:'#1e293b', borderRadius:8, padding:'8px 12px', color:'#94a3b8', fontSize:13, border:'1px solid #334155' },
    removeBtn: { background:'#450a0a', color:'#fca5a5', border:'1px solid #7f1d1d', borderRadius:8, padding:'8px 0', fontSize:12, cursor:'pointer', fontWeight:600, width:'100%' },
    overlay: { position:'absolute' as const, top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#0f172a', border:'1px solid #334155', borderRadius:16, padding:22, zIndex:100, boxShadow:'0 25px 60px rgba(0,0,0,0.6)' },
  };

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', fontFamily:'Inter,system-ui,sans-serif' }}>

      {/* ── LEFT TOOLBAR ─────────────────────────────────────────────────────── */}
      <div style={{ ...S.sideBar, width:68, alignItems:'center', padding:'8px 0', gap:4, borderRight:'1px solid #1e293b' }}>
        {/* Logo */}
        <div style={{ width:36, height:36, borderRadius:10, background:'#1e3a8a', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
          <span style={{ fontSize:18 }}>🏗</span>
        </div>

        {/* 2D / 3D toggle */}
        <div style={{ display:'flex', flexDirection:'column', gap:2, marginBottom:6 }}>
          <button style={S.btnView(viewMode==='2d')} onClick={() => setViewMode('2d')}>2D</button>
          <button style={S.btnView(viewMode==='3d')} onClick={() => setViewMode('3d')}>3D</button>
        </div>
        <div style={{ width:36, height:1, background:'#1e293b', marginBottom:4 }} />

        {/* Tools */}
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => {
                if (viewMode === '3d' && t.id === 'wall') return; // Cannot draw walls in 3D yet
                setTool(t.id);
            }}
            title={`${t.desc} (${t.key})`}
            style={{
                ...S.toolBtn,
                background: tool===t.id ? '#2563eb' : 'transparent',
                color: tool===t.id ? '#fff' : '#94a3b8',
                opacity: (viewMode==='3d' && t.id==='wall') ? 0.3 : 1,
                cursor: (viewMode==='3d' && t.id==='wall') ? 'not-allowed' : 'pointer'
            }}
          >
            <span style={{ lineHeight:1 }}>{t.icon}</span>
            <span style={{ fontSize:8, fontWeight:700, letterSpacing:'0.06em', color: tool===t.id ? '#fff' : '#475569' }}>
              {t.label.slice(0,3).toUpperCase()}
            </span>
          </button>
        ))}

        <div style={{ flex:1 }} />
        <div style={{ width:36, height:1, background:'#1e293b', marginBottom:4 }} />

        {/* Zoom */}
        {[{icon:'+', d:0.25},{icon:'−',d:-0.25}].map(({ icon, d }) => (
          <button key={icon} onClick={() => setZoom(z => Math.max(0.15,Math.min(6,z+d)))}
            style={{ width:36, height:36, borderRadius:8, background:'transparent', color:'#475569', border:'none', cursor:'pointer', fontSize:18, fontWeight:700 }}
            onMouseEnter={e => e.currentTarget.style.color='#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color='#475569'}
          >{icon}</button>
        ))}
        <button onClick={() => { setZoom(1); setPan({x:0,y:0}); }}
            style={{ width:36, height:24, borderRadius:6, background:'transparent', color:'#334155', border:'none', cursor:'pointer', fontSize:9, fontWeight:700 }}
            onMouseEnter={e => e.currentTarget.style.color='#64748b'}
            onMouseLeave={e => e.currentTarget.style.color='#334155'}
        >FIT</button>
        <div style={{ marginBottom:8 }} />
      </div>

      {/* ── CENTER AREA ──────────────────────────────────────────────────────── */}
      <div ref={containerRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>

        {/* ── 2D Canvas ── */}
        {viewMode === '2d' && (
          <>
            <canvas
              ref={canvasRef} width={canvasSize.w} height={canvasSize.h}
              style={{ display:'block', cursor:getCursor() }}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
              onWheel={onWheel} onContextMenu={onRightClick}
            />

            {/* View toggles */}
            <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:12 }}>
              {/* Blind spot toggle */}
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(15,23,42,0.85)', borderRadius:10, padding:'6px 12px', backdropFilter:'blur(4px)', cursor:'pointer' }}
                onClick={() => setShowBlinds(v => !v)}>
                <div style={{ width:32, height:18, borderRadius:99, background:showBlinds?'#2563eb':'#334155', position:'relative', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:3, left:showBlinds?15:3, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                </div>
                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>PONTOS CEGOS</span>
              </div>
              
              {/* DORI Legend toggle */}
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(15,23,42,0.85)', borderRadius:10, padding:'6px 12px', backdropFilter:'blur(4px)', cursor:'pointer' }}
                onClick={() => setShowDoriLegend(v => !v)}>
                <div style={{ width:32, height:18, borderRadius:99, background:showDoriLegend?'#2563eb':'#334155', position:'relative', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:3, left:showDoriLegend?15:3, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                </div>
                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>LEGENDA DORI</span>
              </div>
            </div>

            {/* ── Toolbar overlays (top right) ─────────────────────────────── */}
            <div style={{ position:'absolute', top:12, right:12, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>

              {/* Coverage badge + action buttons */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button
                  onClick={() => {
                    const { sceneObjects, walls } = useProjectStore.getState();
                    exportProjectToPDF('tycon-editor-workspace', 'Projeto TYCON', sceneObjects, walls);
                  }}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
                  onMouseOver={e => e.currentTarget.style.background = '#d97706'}
                  onMouseOut={e => e.currentTarget.style.background = '#f59e0b'}
                >
                  📄 Exportar PDF
                </button>
                <button
                  onClick={() => setShowCalculator(true)}
                  style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}
                  onMouseOver={e => e.currentTarget.style.background = '#0284c7'}
                  onMouseOut={e => e.currentTarget.style.background = '#0ea5e9'}
                >
                  💾 Storage & Rede
                </button>
                
                {/* Controles da Planta Baixa (só aparece se tiver imagem) */}
                {imgEl && (
                  <div style={{ background: 'rgba(15,23,42,0.85)', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(4px)', border: '1px solid #334155' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Tamanho:</span>
                    <input 
                      type="range" min="0.1" max="10" step="0.1" 
                      value={floorPlanScale} onChange={e => setFloorPlanScale(parseFloat(e.target.value))}
                      style={{ width: 80, cursor: 'pointer' }}
                    />
                  </div>
                )}

                {/* Extrair Paredes Automáticas */}
                {svgLayers.length > 0 && (
                  <button
                    onClick={() => setShowLayerModal(true)}
                    style={{ background: '#10b981', color: '#fff', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'background 0.2s' }}
                  >
                    <span style={{ fontSize: 14 }}>🪄</span>
                    Extrair Paredes
                  </button>
                )}

                {/* Upload Planta Baixa */}
                <input
                  type="file"
                  accept="image/*,.pdf,.dwg"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: '#3b82f6', color: '#fff', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'background 0.2s' }}
                >
                  <span style={{ fontSize: 14 }}>{isConverting ? '⏳' : '📄'}</span>
                  {isConverting ? 'Processando...' : 'Carregar planta'}
                </button>

                {/* Heatmap toggle */}
                <button
                  onClick={() => setShowHeatmap(v => !v)}
                  title="Mapa de Calor"
                  style={{ background: showHeatmap ? 'rgba(234,179,8,0.85)' : 'rgba(15,23,42,0.88)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:6, border:'1px solid '+(showHeatmap?'#f59e0b':'#334155'), cursor:'pointer', backdropFilter:'blur(4px)', transition:'all 0.2s' }}
                >
                  <span style={{ fontSize:13 }}>🔥</span>
                  <span style={{ fontSize:11, color: showHeatmap?'#1a1a1a':'#f1f5f9', fontWeight:700 }}>Mapa de Calor</span>
                </button>

                {/* Report toggle */}
                <button
                  onClick={() => setShowReport(v => !v)}
                  title="Relatório de Segurança"
                  style={{ background: showReport ? 'rgba(37,99,235,0.9)' : 'rgba(15,23,42,0.88)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:6, border:'1px solid '+(showReport?'#3b82f6':'#334155'), cursor:'pointer', backdropFilter:'blur(4px)', transition:'all 0.2s' }}
                >
                  <span style={{ fontSize:13 }}>📊</span>
                  <span style={{ fontSize:11, color:'#f1f5f9', fontWeight:700 }}>Relatório</span>
                </button>

                {/* Coverage % badge */}
                {coveragePct !== null && (
                  <div style={{ background:'rgba(15,23,42,0.9)', borderRadius:10, padding:'6px 14px', display:'flex', alignItems:'center', gap:8, backdropFilter:'blur(4px)', border:'1px solid #1e293b' }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:coveragePct>80?'#22c55e':coveragePct>50?'#f59e0b':'#ef4444' }} />
                    <span style={{ fontSize:12, color:'#f1f5f9', fontWeight:700 }}>{coveragePct}% coberto</span>
                  </div>
                )}
              </div>

              {/* ── Heatmap Legend ────────────────────────────────────────────── */}
              {showHeatmap && (
                <div style={{ background:'rgba(15,23,42,0.92)', borderRadius:10, padding:'10px 14px', border:'1px solid #1e293b', backdropFilter:'blur(4px)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>Legenda do Mapa</div>
                  {[
                    { color:'rgba(34,197,94,0.7)', label:'Alta cobertura (múltiplas câmeras)' },
                    { color:'rgba(234,179,8,0.7)',  label:'Cobertura única (1 câmera)' },
                    { color:'rgba(239,68,68,0.7)',  label:'Zona cega (sem cobertura)' },
                  ].map(({ color, label }) => (
                    <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:color, flexShrink:0 }} />
                      <span style={{ fontSize:11, color:'#94a3b8' }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Security Report Panel ─────────────────────────────────────── */}
              {showReport && (() => {
                const persons = furniture.filter(o => o.type === 'person');
                const detected = persons.filter(o => visPolygons.some(p => pointInPoly(o.position[0], o.position[2], p)));
                const score = coveragePct ?? 0;
                const scoreColor = score > 80 ? '#22c55e' : score > 50 ? '#f59e0b' : '#ef4444';
                const camsByModel = cameras.reduce((acc, c) => {
                  const m = (c as any).model ?? 'Câmera';
                  acc[m] = (acc[m] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                return (
                  <div style={{ background:'rgba(10,18,40,0.97)', borderRadius:14, padding:'18px', border:'1px solid #1e293b', backdropFilter:'blur(8px)', width:300, boxShadow:'0 25px 60px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9', letterSpacing:'0.05em', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                      <span>📊</span> RELATÓRIO DE SEGURANÇA
                    </div>

                    {/* Score de segurança */}
                    <div style={{ background:'#0f172a', borderRadius:10, padding:'12px 14px', marginBottom:10, border:'1px solid #1e293b' }}>
                      <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Score de Segurança</div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ fontSize:32, fontWeight:900, color:scoreColor, lineHeight:1 }}>{score}%</div>
                        <div style={{ flex:1 }}>
                          <div style={{ background:'#1e293b', borderRadius:99, height:6, overflow:'hidden' }}>
                            <div style={{ width:`${score}%`, background:`linear-gradient(90deg, ${scoreColor}88, ${scoreColor})`, height:'100%', borderRadius:99, transition:'width 0.5s' }} />
                          </div>
                          <div style={{ fontSize:10, color: scoreColor, marginTop:4, fontWeight:600 }}>
                            {score > 80 ? '✅ Excelente cobertura' : score > 50 ? '⚠️ Cobertura parcial' : '❌ Cobertura insuficiente'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Câmeras */}
                    <div style={{ background:'#0f172a', borderRadius:10, padding:'12px 14px', marginBottom:10, border:'1px solid #1e293b' }}>
                      <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Câmeras Instaladas</div>
                      <div style={{ fontSize:24, fontWeight:900, color:'#38bdf8', marginBottom:8 }}>{cameras.length}</div>
                      {Object.entries(camsByModel).slice(0, 4).map(([model, count]) => (
                        <div key={model} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#64748b', marginBottom:3 }}>
                          <span style={{ color:'#94a3b8' }}>{model.replace('Illustra ', '')}</span>
                          <span style={{ color:'#38bdf8', fontWeight:700 }}>×{count}</span>
                        </div>
                      ))}
                    </div>

                    {/* Pessoas monitoradas */}
                    {persons.length > 0 && (
                      <div style={{ background:'#0f172a', borderRadius:10, padding:'12px 14px', marginBottom:10, border:'1px solid #1e293b' }}>
                        <div style={{ fontSize:10, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Monitoramento de Pessoas</div>
                        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:22, fontWeight:900, color:'#22c55e' }}>{detected.length}</div>
                            <div style={{ fontSize:9, color:'#22c55e', fontWeight:600 }}>DETECTADAS</div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:22, fontWeight:900, color:'#ef4444' }}>{persons.length - detected.length}</div>
                            <div style={{ fontSize:9, color:'#ef4444', fontWeight:600 }}>OCULTAS</div>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ background:'#1e293b', borderRadius:99, height:6, overflow:'hidden' }}>
                              <div style={{ width:`${persons.length ? (detected.length/persons.length)*100 : 0}%`, background:'linear-gradient(90deg, #16a34a, #22c55e)', height:'100%', borderRadius:99 }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Infra */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[
                        { icon:'💾', label:'Armazenamento', value:'~45 GB/dia' },
                        { icon:'📡', label:'Banda', value:`${cameras.length * 4} Mbps` },
                      ].map(({ icon, label, value }) => (
                        <div key={label} style={{ background:'#0f172a', borderRadius:8, padding:'10px 12px', border:'1px solid #1e293b', textAlign:'center' }}>
                          <div style={{ fontSize:16 }}>{icon}</div>
                          <div style={{ fontSize:9, color:'#475569', fontWeight:600, textTransform:'uppercase', marginTop:4 }}>{label}</div>
                          <div style={{ fontSize:13, color:'#38bdf8', fontWeight:700, marginTop:2 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>


            {/* Status bar */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(15,23,42,0.9)', borderTop:'1px solid #1e293b', display:'flex', alignItems:'center', padding:'4px 16px', gap:16, backdropFilter:'blur(4px)' }}>
              <span style={{ fontSize:11, color:'#475569' }}>
                {TOOLS.find(t => t.id===tool)?.desc}
                {tool==='wall' && wallStart ? ' → clique para finalizar | ESC cancelar' : ''}
              </span>
              <div style={{ flex:1 }} />
              <span style={{ fontSize:11, color:'#334155', fontFamily:'monospace' }}>
                X:<span style={{ color:'#475569' }}>{snap(mouseWorld.x).toFixed(2)}m</span>{' '}
                Y:<span style={{ color:'#475569' }}>{snap(mouseWorld.y).toFixed(2)}m</span>
              </span>
              <span style={{ fontSize:11, color:'#334155' }}>Zoom:<span style={{ color:'#475569' }}>{Math.round(zoom*100)}%</span></span>
              <span style={{ fontSize:11, color:'#334155' }}>{walls.length} paredes · {cameras.length} câmeras</span>
            </div>
            
          </>
        )}

        {/* Camera picker */}
        {showCamPicker && (
          <div style={{ ...S.overlay, width:380 }}>
            <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:15, marginBottom:4 }}>Modelo de Câmera</div>
            <div style={{ color:'#475569', fontSize:12, marginBottom:16 }}>Posição: ({pendingPos?.x.toFixed(2)}m, {pendingPos?.y.toFixed(2)}m)</div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4, marginBottom: 12 }}>
              {CAMERA_CATALOG.map((cam: any) => {
                const c = CAM_COLORS[cam.model] ?? '#0ea5e9';
                const modelLower = cam.model.toLowerCase();
                const type = (modelLower.includes('flex') || modelLower.includes('dome') || modelLower.includes('fisheye')) ? 'dome' : 
                             (modelLower.includes('bullet') || modelLower.includes('pro')) ? 'bullet' : 'radar';
                
                return (
                  <button key={cam.model} onClick={() => addCamera(cam)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:10, border:'1px solid #1e293b', background:'#1e293b', cursor:'pointer', textAlign:'left', width:'100%', marginBottom:8, transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=c; e.currentTarget.style.background='#172232'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#1e293b'; e.currentTarget.style.background='#1e293b'; }}
                  >
                    {type === 'dome' && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" style={{flexShrink:0, filter:`drop-shadow(0 0 4px ${c}80)`}}>
                        <circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.05)"/>
                        <circle cx="12" cy="12" r="4" fill={c}/>
                        <circle cx="13" cy="11" r="1.5" fill="#fff" stroke="none"/>
                      </svg>
                    )}
                    {type === 'bullet' && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" style={{flexShrink:0, filter:`drop-shadow(0 0 4px ${c}80)`}}>
                        <rect x="4" y="7" width="14" height="10" rx="3" fill="rgba(255,255,255,0.05)"/>
                        <path d="M18 8 L21 8 L21 16 L18 16" fill={c} stroke="none"/>
                      </svg>
                    )}
                    {type === 'radar' && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" style={{flexShrink:0, filter:`drop-shadow(0 0 4px ${c}80)`}}>
                        <ellipse cx="12" cy="12" rx="10" ry="5" fill="rgba(255,255,255,0.05)"/>
                        <circle cx="12" cy="12" r="2.5" fill={c} stroke="none"/>
                      </svg>
                    )}
                    <div>
                      <div style={{ color:'#f1f5f9', fontSize:13, fontWeight:600 }}>{cam.model}</div>
                      <div style={{ color:'#94a3b8', fontSize:11, marginTop:2 }}>Câmera IP · {cam.doriAngle}° FOV · {cam.doriRadius}m · {cam.resolution} @ {cam.fps}fps</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setShowCamPicker(false); setPendingPos(null); }}
              style={{ width:'100%', padding:'9px', borderRadius:8, background:'#1e293b', color:'#64748b', border:'1px solid #334155', cursor:'pointer', fontSize:12, marginTop:4 }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Furniture picker */}
        {showFurnPicker && (
          <div style={{ ...S.overlay, width:340 }}>
            <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:15, marginBottom:16 }}>Adicionar Mobília</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              {FURN_ITEMS.map(item => (
                <button key={item.type} onClick={() => addFurniture(item.type, item.color)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'14px 8px', borderRadius:12, border:'1px solid #1e293b', background:'#1e293b', cursor:'pointer', color:'#f1f5f9', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#2563eb'; e.currentTarget.style.background='#172232'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#1e293b'; e.currentTarget.style.background='#1e293b'; }}
                >
                  <span style={{ fontSize:28 }}>{item.icon}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:'#94a3b8' }}>{item.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowFurnPicker(false)}
              style={{ width:'100%', padding:'9px', borderRadius:8, background:'#1e293b', color:'#64748b', border:'1px solid #334155', cursor:'pointer', fontSize:12, marginTop:14 }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Scale Modal */}
        {showScaleModal && (
          <div style={{ ...S.overlay, width:320 }}>
            <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:15, marginBottom:12 }}>Calibrar Escala da Planta</div>
            <div style={{ color:'#94a3b8', fontSize:12, marginBottom:16, lineHeight:1.4 }}>
              Você desenhou uma linha. Qual é o tamanho real dessa linha no mundo físico?
            </div>
            
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:20 }}>
              <input 
                type="number" step="0.1" autoFocus
                value={scaleInput} onChange={e => setScaleInput(e.target.value)}
                style={{ flex:1, padding:'10px 14px', borderRadius:8, background:'#0f172a', border:'1px solid #3b82f6', color:'#fff', fontSize:16, outline:'none' }}
              />
              <span style={{ color:'#94a3b8', fontWeight:700 }}>metros</span>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button 
                onClick={() => {
                  setShowScaleModal(false); setScaleLineStart(null); setScaleLineEnd(null); setTool('select');
                }}
                style={{ flex:1, padding:'10px', borderRadius:8, background:'#1e293b', color:'#94a3b8', border:'none', cursor:'pointer', fontWeight:600 }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (scaleLineStart && scaleLineEnd) {
                    const wDist = Math.hypot(scaleLineEnd.wx - scaleLineStart.wx, scaleLineEnd.wy - scaleLineStart.wy);
                    const pDist = wDist * getPPM();
                    const val = parseFloat(scaleInput);
                    if (!isNaN(val) && val > 0) {
                      useProjectStore.getState().setPixelsPerMeter(pDist / val);
                    }
                  }
                  setShowScaleModal(false); setScaleLineStart(null); setScaleLineEnd(null); setTool('select');
                }}
                style={{ flex:1, padding:'10px', borderRadius:8, background:'#2563eb', color:'#fff', border:'none', cursor:'pointer', fontWeight:600, boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}
              >
                Aplicar Escala
              </button>
            </div>
          </div>
        )}

        {/* ── 3D View ── */}
        {viewMode === '3d' && (
          <Suspense fallback={<div style={{color:'#fff', padding:20}}>Carregando 3D...</div>}>
            <FloorPlan3D 
               tool={tool}
               onFloorClick={(x, z) => {
                 if (tool === 'camera') {
                   setPendingPos({ x, y: z });
                   setShowCamPicker(true);
                   setTool('select');
                 } else if (tool === 'furniture') {
                   setPendingPos({ x, y: z });
                   setShowFurnPicker(true);
                   setTool('select');
                 } else if (tool === 'select') {
                   setSelectedWallId(null);
                   setSelectedSceneObjectId(null);
                 }
               }}
               onObjectClick={(type, id) => {
                 if (tool === 'erase') {
                   if (type === 'wall') removeWall(id);
                   else removeSceneObject(id);
                 } else {
                   if (type === 'wall') { setSelectedWallId(id); setSelectedSceneObjectId(null); }
                   else { setSelectedSceneObjectId(id); setSelectedWallId(null); }
                 }
               }}
            />
          </Suspense>
        )}
      </div>

      {/* ── RIGHT PROPERTIES PANEL ─────────────────────────────────────────── */}
      <div style={S.panel}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #1e293b' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#334155', letterSpacing:'0.08em', textTransform:'uppercase' }}>
            {viewMode==='3d' ? 'Vista 3D' : selectedWall ? 'Parede' : selectedObj?.type==='camera' ? 'Câmera' : selectedObj ? 'Mobília' : 'Painel de Projeto'}
          </div>
        </div>

        {/* 3D mode info */}
        {viewMode==='3d' && !selectedWall && !selectedObj && (
          <div style={S.section}>
            <div style={S.sTitle}>Controles 3D</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[['Arrastar','Orbitar câmera'],['Scroll','Zoom'],['Clique direito','Pan'],['Duplo clique','Reset']].map(([k,l]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#475569' }}>{l}</span>
                  <kbd style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:5, padding:'1px 7px', fontSize:10, color:'#64748b', fontFamily:'monospace' }}>{k}</kbd>
                </div>
              ))}
            </div>
            <div style={{ marginTop:16 }}>
              <div style={S.sTitle}>Resumo</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Paredes',  value: walls.length },
                  { label:'Câmeras',  value: cameras.length },
                  { label:'Móveis',   value: furniture.length },
                  { label:'Cobertura',value: coveragePct!==null?`${coveragePct}%`:'—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background:'#1e293b', borderRadius:8, padding:'10px 12px', border:'1px solid #334155' }}>
                    <div style={{ fontSize:10, color:'#475569', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#38bdf8' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setViewMode('2d')}
              style={{ marginTop:16, width:'100%', padding:'9px', borderRadius:8, background:'#2563eb', color:'#fff', border:'none', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              ← Voltar para 2D
            </button>
          </div>
        )}

        {/* 2D empty state */}
        {viewMode==='2d' && !selectedWall && !selectedObj && (
          <div style={S.section}>
            <div style={S.sTitle}>Atalhos</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[['V','Selecionar'],['W','Parede'],['C','Câmera'],['F','Mobília'],['E','Apagar'],['Del','Remover'],['ESC','Cancelar'],['Alt+Drag','Navegar'],['Scroll','Zoom']].map(([k,l]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#475569' }}>{l}</span>
                  <kbd style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:5, padding:'1px 7px', fontSize:10, color:'#64748b', fontFamily:'monospace' }}>{k}</kbd>
                </div>
              ))}
            </div>
            <div style={{ marginTop:16 }}>
              <div style={S.sTitle}>Resumo</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Paredes',  value:walls.length },
                  { label:'Câmeras',  value:cameras.length },
                  { label:'Móveis',   value:furniture.length },
                  { label:'Cobertura',value:coveragePct!==null?`${coveragePct}%`:'—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background:'#1e293b', borderRadius:8, padding:'10px 12px', border:'1px solid #334155' }}>
                    <div style={{ fontSize:10, color:'#475569', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#38bdf8' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Wall Properties */}
        {selectedWall && (
          <div style={S.section}>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {(['thickness','height'] as const).map(prop => (
                <div key={prop} style={{ flex:1, background:'#1e293b', borderRadius:8, padding:'8px 10px', border:'1px solid #334155' }}>
                  <div style={{ fontSize:9, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>{prop==='thickness'?'Espessura':'Altura'}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#38bdf8', marginTop:2 }}>
                    {prop==='thickness'?`${(selectedWall.thickness*100).toFixed(0)}cm`:`${selectedWall.height.toFixed(1)}m`}
                  </div>
                </div>
              ))}
            </div>
            <div style={S.lbl}><span>Comprimento</span><span style={S.val}>{Math.hypot(selectedWall.x2-selectedWall.x1,selectedWall.y2-selectedWall.y1).toFixed(2)}m</span></div>
            <div style={{ ...S.field, marginBottom:14, fontSize:11 }}>
              ({selectedWall.x1.toFixed(1)},{selectedWall.y1.toFixed(1)}) → ({selectedWall.x2.toFixed(1)},{selectedWall.y2.toFixed(1)})
            </div>
            <div style={S.lbl}><span>Espessura</span><span style={S.val}>{(selectedWall.thickness*100).toFixed(0)}cm</span></div>
            <input type="range" min={5} max={60} step={5} value={selectedWall.thickness*100}
              onChange={e => updateWall(selectedWall.id,{thickness:Number(e.target.value)/100})}
              style={{ ...S.slider, marginBottom:14 }} />
            <div style={S.lbl}><span>Altura</span><span style={S.val}>{selectedWall.height.toFixed(1)}m</span></div>
            <input type="range" min={20} max={60} step={1} value={selectedWall.height*10}
              onChange={e => updateWall(selectedWall.id,{height:Number(e.target.value)/10})}
              style={{ ...S.slider, marginBottom:16 }} />
            
            <div style={S.lbl}><span>Cor da Parede</span></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['#f8fafc', '#e2e8f0', '#94a3b8', '#fca5a5', '#bbf7d0', '#bfdbfe', '#fef08a', '#e9d5ff'].map(c => (
                <button
                  key={c}
                  onClick={() => updateWall(selectedWall.id, { color: c })}
                  style={{
                    width: 24, height: 24, borderRadius: 4, background: c,
                    border: (selectedWall.color || '#f8fafc') === c ? '2px solid #38bdf8' : '1px solid #334155',
                    cursor: 'pointer'
                  }}
                />
              ))}
              <input 
                type="color" 
                value={selectedWall.color ?? '#f8fafc'} 
                onChange={e => updateWall(selectedWall.id, { color: e.target.value })}
                style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent', borderRadius: 4 }}
              />
            </div>

            <button onClick={() => { removeWall(selectedWall.id); setSelectedWallId(null); }} style={S.removeBtn}>Remover Parede</button>
          </div>
        )}

        {/* Camera Properties */}
        {selectedObj?.type==='camera' && (
          <div style={S.section}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, background:'#1e293b', borderRadius:10, padding:'10px 12px', border:'1px solid #334155' }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:selectedObj.color, boxShadow:`0 0 8px ${selectedObj.color}80` }} />
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#f1f5f9' }}>{selectedObj.model ?? 'Câmera'}</div>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:10, color:'#94a3b8' }}>X:</span>
                    <input type="number" step={0.5} value={Number(selectedObj.position[0].toFixed(2))} 
                      onChange={e => updateSceneObject(selectedObj.id, { position: [Number(e.target.value), selectedObj.position[1], selectedObj.position[2]] })}
                      style={{ width:45, background:'#0f172a', border:'1px solid #334155', color:'#fff', borderRadius:4, padding:2, fontSize:10 }} />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:10, color:'#94a3b8' }}>Y:</span>
                    <input type="number" step={0.5} value={Number(selectedObj.position[2].toFixed(2))} 
                      onChange={e => updateSceneObject(selectedObj.id, { position: [selectedObj.position[0], selectedObj.position[1], Number(e.target.value)] })}
                      style={{ width:45, background:'#0f172a', border:'1px solid #334155', color:'#fff', borderRadius:4, padding:2, fontSize:10 }} />
                  </div>
                </div>
              </div>
            </div>
            <div style={S.lbl}>
              <span>Lente Varifocal (Distância Focal)</span>
              <span style={S.val}>{selectedObj.focalLength?.toFixed(1) ?? 2.8} mm</span>
            </div>
            <input type="range" min={2.8} max={50.0} step={0.1} value={selectedObj.focalLength ?? 2.8}
              onChange={e => {
                const f = Number(e.target.value);
                const sw = selectedObj.sensorWidth ?? 5.27; // Default to 1/2.8"
                const newFov = calculateFOV(f, sw);
                updateSceneObject(selectedObj.id, { focalLength: f, fov: Math.round(newFov) });
              }}
              style={{ ...S.slider, marginBottom: 14 }} />

            <div style={S.lbl}><span>Resolução (Pixels)</span></div>
            <select 
              value={selectedObj.resolution ?? '1920x1080'}
              onChange={e => updateSceneObject(selectedObj.id, { resolution: e.target.value })}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#0f172a', border:'1px solid #334155', color:'#fff', fontSize:12, marginBottom:14 }}
            >
              <option value="1280x720">1MP (720p - 1280x720)</option>
              <option value="1920x1080">2MP (1080p - 1920x1080)</option>
              <option value="2560x1440">4MP (1440p - 2560x1440)</option>
              <option value="3840x2160">8MP (4K - 3840x2160)</option>
            </select>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={S.lbl}>
                <span>Sensor</span>
              </div>
              <select 
                value={selectedObj.sensorWidth?.toString() ?? '5.27'}
                onChange={e => {
                  const sw = parseFloat(e.target.value);
                  const f = selectedObj.focalLength ?? 2.8;
                  const newFov = calculateFOV(f, sw);
                  updateSceneObject(selectedObj.id, { sensorWidth: sw, fov: Math.round(newFov) });
                }}
                style={{ width:100, padding:'4px 8px', borderRadius:6, background:'#0f172a', border:'1px solid #334155', color:'#fff', fontSize:11 }}
              >
                <option value="4.8">1/3"</option>
                <option value="5.27">1/2.8"</option>
                <option value="6.4">1/2"</option>
                <option value="8.8">1/1.2"</option>
              </select>
            </div>

            <div style={S.lbl}>
              <span>FOV Resultante</span>
              <span style={S.val}>{selectedObj.fov ?? 75}°</span>
            </div>
            
            <div style={{ height:1, background:'#334155', margin:'16px 0' }} />

            <div style={S.lbl}><span>Altura de Instalação</span><span style={S.val}>{selectedObj.position[1].toFixed(2)}m</span></div>
            <input type="range" min={1.5} max={8} step={0.1} value={selectedObj.position[1]}
              onChange={e => updateSceneObject(selectedObj.id, { position: [selectedObj.position[0], Number(e.target.value), selectedObj.position[2]] })}
              style={{ ...S.slider, marginBottom:14 }} />

            <div style={S.lbl}>
              <span>Inclinação (Tilt)</span>
              <span style={S.val}>{selectedObj.tilt ?? 15}° {(selectedObj.tilt ?? 15) === 0 ? '(Horizontal)' : (selectedObj.tilt ?? 15) >= 80 ? '(Nadir)' : ''}</span>
            </div>
            <input type="range" min={-10} max={90} step={1} value={selectedObj.tilt ?? 15}
              onChange={e => updateSceneObject(selectedObj.id, { tilt: Number(e.target.value) })}
              style={{ ...S.slider, marginBottom:14 }} />

            <div style={{ height:1, background:'#334155', margin:'16px 0' }} />

            <div style={S.lbl}><span>Alcance Simulado na Planta (Raio)</span><span style={S.val}>{selectedObj.range??10}m</span></div>
            <input type="range" min={2} max={100} step={1} value={selectedObj.range??10}
              onChange={e => updateSceneObject(selectedObj.id,{range:Number(e.target.value)})}
              style={{ ...S.slider, marginBottom:14 }} />

            {(() => {
              const f = selectedObj.focalLength ?? 2.8;
              const sw = selectedObj.sensorWidth ?? 5.27;
              const rw = parseInt((selectedObj.resolution ?? '1920x1080').split('x')[0]);
              const dori = calculateDORIZones(rw, f, sw);
              return (
                <div style={{ background:'#0f172a', borderRadius:8, padding:'10px 12px', border:'1px solid #1e293b', marginBottom:14 }}>
                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Alcances DORI Calculados</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#ef4444', marginBottom:4 }}><span>Identificação (250PPM)</span> <span>{dori.identify.toFixed(1)}m</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#facc15', marginBottom:4 }}><span>Reconhecimento (125PPM)</span> <span>{dori.recognize.toFixed(1)}m</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#22c55e', marginBottom:4 }}><span>Observação (62PPM)</span> <span>{dori.observe.toFixed(1)}m</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#06b6d4', marginBottom:4 }}><span>Detecção (25PPM)</span> <span>{dori.detect.toFixed(1)}m</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#3b82f6' }}><span>Monitoramento (12PPM)</span> <span>{dori.monitor.toFixed(1)}m</span></div>
                </div>
              );
            })()}

            <button 
              onClick={() => {
                const { setActiveCameraViewId } = useProjectStore.getState();
                setActiveCameraViewId(selectedObj.id);
                setViewMode('3d');
              }}
              style={{ 
                width: '100%', background: '#3b82f6', color: '#fff', border: 'none', 
                borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, 
                cursor: 'pointer', marginBottom: 14,
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)'
              }}
            >
              👁️ Ver na Perspectiva da Câmera
            </button>

            {/* Camera Area Coverage m² */}
            {(() => {
              const camIdx = cameras.findIndex(c => c.id === selectedObj.id);
              if (camIdx >= 0 && visPolygons[camIdx]) {
                const visibleArea = getPolygonArea(visPolygons[camIdx]);
                return (
                  <>
                    <div style={S.lbl}>
                      <span>Área Coberta</span>
                      <span style={S.val}>{Math.round(visibleArea)} m²</span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: '#1e293b', borderRadius: 2, marginBottom: 14 }}>
                      <div style={{ height: '100%', width: '100%', background: '#0091da', borderRadius: 2 }} />
                    </div>
                  </>
                );
              }
              return null;
            })()}

            <div style={S.lbl}>
              <span>Direção</span>
              <span style={S.val}>{['N','NE','E','SE','S','SO','O','NO'][Math.round(fmtBearing(selectedObj.rotation[1])/45)%8]} {Math.round(fmtBearing(selectedObj.rotation[1]))}°</span>
            </div>
            <input type="range" min={0} max={359} step={1}
              value={Math.round(fmtBearing(selectedObj.rotation[1]))}
              onChange={e => updateSceneObject(selectedObj.id,{rotation:[0,bearingToR1(Number(e.target.value)),0]})}
              style={{ ...S.slider, marginBottom:12 }} />
            {/* Mini compass */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
              <div style={{ position:'relative', width:60, height:60 }}>
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid #1e293b', background:'#0f172a' }} />
                {['N','E','S','O'].map((d,i) => {
                  const rad = i*Math.PI/2 - Math.PI/2;
                  return <span key={d} style={{ position:'absolute', fontSize:8, fontWeight:700, color:'#334155', left:30+Math.cos(rad)*22-4, top:30+Math.sin(rad)*22-5 }}>{d}</span>;
                })}
                <div style={{ position:'absolute', bottom:'50%', left:'50%', width:2, height:20, background:selectedObj.color, transformOrigin:'bottom center', transform:`translateX(-50%) rotate(${fmtBearing(selectedObj.rotation[1])}deg)`, borderRadius:2, boxShadow:`0 0 6px ${selectedObj.color}` }} />
                <div style={{ position:'absolute', width:5, height:5, borderRadius:'50%', background:'#fff', left:'50%', top:'50%', transform:'translate(-50%,-50%)' }} />
              </div>
            </div>
            <button onClick={() => { removeSceneObject(selectedObj.id); setSelectedSceneObjectId(null); }} style={S.removeBtn}>Remover Câmera</button>
          </div>
        )}

        {/* Furniture Properties */}
        {selectedObj && selectedObj.type!=='camera' && (
          <div style={S.section}>
            <div style={{ background:'#1e293b', borderRadius:10, padding:'10px 12px', border:'1px solid #334155', marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#f1f5f9' }}>{FURNITURE_LABELS[selectedObj.type]??selectedObj.type}</div>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:10, color:'#94a3b8' }}>X:</span>
                  <input type="number" step={0.5} value={Number(selectedObj.position[0].toFixed(2))} 
                    onChange={e => updateSceneObject(selectedObj.id, { position: [Number(e.target.value), selectedObj.position[1], selectedObj.position[2]] })}
                    style={{ width:45, background:'#0f172a', border:'1px solid #334155', color:'#fff', borderRadius:4, padding:2, fontSize:10 }} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:10, color:'#94a3b8' }}>Y:</span>
                  <input type="number" step={0.5} value={Number(selectedObj.position[2].toFixed(2))} 
                    onChange={e => updateSceneObject(selectedObj.id, { position: [selectedObj.position[0], selectedObj.position[1], Number(e.target.value)] })}
                    style={{ width:45, background:'#0f172a', border:'1px solid #334155', color:'#fff', borderRadius:4, padding:2, fontSize:10 }} />
                </div>
              </div>
            </div>
            <div style={S.lbl}><span>Rotação</span><span style={S.val}>{Math.round(fmtBearing(selectedObj.rotation[1]))}°</span></div>
            <input type="range" min={0} max={359} step={1}
              value={Math.round(fmtBearing(selectedObj.rotation[1]))}
              onChange={e => updateSceneObject(selectedObj.id,{rotation:[0,bearingToR1(Number(e.target.value)),0]})}
              style={{ ...S.slider, marginBottom:14 }} />

            {selectedObj.type === 'person' ? (
              <>
                <div style={S.lbl}>
                  <span>Altura</span>
                  <span style={S.val}>{((selectedObj.scale?.[1] ?? 1.0) * 1.75).toFixed(2)}m</span>
                </div>
                <input type="range" min={0.8} max={2.2} step={0.05}
                  value={selectedObj.scale?.[1] ?? 1.0}
                  onChange={e => updateSceneObject(selectedObj.id, { scale: [selectedObj.scale[0], Number(e.target.value), selectedObj.scale[2]] })}
                  style={{ ...S.slider, marginBottom:16 }} />
              </>
            ) : (
              <>
                <div style={S.lbl}><span>Largura</span><span style={S.val}>{selectedObj.scale[0].toFixed(1)}×</span></div>
                <input type="range" min={0.3} max={5} step={0.1} value={selectedObj.scale[0]}
                  onChange={e => updateSceneObject(selectedObj.id,{scale:[Number(e.target.value),selectedObj.scale[1],selectedObj.scale[2]]})}
                  style={{ ...S.slider, marginBottom:14 }} />
                <div style={S.lbl}><span>Profundidade</span><span style={S.val}>{selectedObj.scale[2].toFixed(1)}×</span></div>
                <input type="range" min={0.3} max={5} step={0.1} value={selectedObj.scale[2]}
                  onChange={e => updateSceneObject(selectedObj.id,{scale:[selectedObj.scale[0],selectedObj.scale[1],Number(e.target.value)]})}
                  style={{ ...S.slider, marginBottom:16 }} />
              </>
            )}

            {selectedObj.type === 'car' && (() => {
              const isPlateRead = lprPolygons.some(poly => pointInPoly(selectedObj.position[0], selectedObj.position[2], poly));
              return (
                <div style={{ background:'#0f172a', borderRadius:8, padding:'10px 12px', border:'1px solid #1e293b', marginBottom:14 }}>
                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Reconhecimento de Placa (LPR)</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontFamily:'monospace', fontSize:16, fontWeight:700, color:'#f1f5f9', background:'#1e293b', padding:'4px 10px', borderRadius:6, border:'1px solid #334155' }}>
                      {selectedObj.plate ?? '---'}
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, color: isPlateRead ? '#22c55e' : '#64748b' }}>
                      {lprCameras.length === 0 ? 'Sem câmera LPR no projeto' : isPlateRead ? '✓ Placa Lida' : '✗ Fora de Alcance'}
                    </span>
                  </div>
                  <button
                    onClick={() => updateSceneObject(selectedObj.id, { plate: generatePlate() })}
                    style={{ width:'100%', padding:'7px 0', borderRadius:8, background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', cursor:'pointer', fontSize:11, fontWeight:600 }}
                  >
                    Gerar Nova Placa
                  </button>
                </div>
              );
            })()}

            <button onClick={() => { removeSceneObject(selectedObj.id); setSelectedSceneObjectId(null); }} style={S.removeBtn}>
              {selectedObj.type === 'person' ? 'Remover Pessoa' : 'Remover Móvel'}
            </button>
          </div>
        )}

        {/* Wall tool config */}
        {viewMode==='2d' && tool==='wall' && (
          <div style={{ ...S.section, borderTop:'1px solid #1e293b', borderBottom:'none', marginTop:'auto' }}>
            <div style={S.sTitle}>Configuração de Parede</div>
            <div style={S.lbl}><span>Espessura</span><span style={S.val}>{(wallThickness*100).toFixed(0)}cm</span></div>
            <input type="range" min={5} max={60} step={5} value={wallThickness*100}
              onChange={e => setWallThickness(Number(e.target.value)/100)} style={{ ...S.slider, marginBottom:14 }} />
            <div style={S.lbl}><span>Altura do pé-direito</span><span style={S.val}>{wallHeight.toFixed(1)}m</span></div>
            <input type="range" min={20} max={60} step={1} value={wallHeight*10}
              onChange={e => setWallHeight(Number(e.target.value)/10)} style={S.slider} />
          </div>
        )}
      </div>
      {/* ── Modal de Extração de Paredes ── */}
      {showLayerModal && (
        <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(15,23,42,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1e293b', padding:32, borderRadius:16, border:'1px solid #334155', width:400, boxShadow:'0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ color:'#f1f5f9', margin:0, marginBottom:8, fontSize:20 }}>🪄 Extração Inteligente</h2>
            <p style={{ color:'#94a3b8', fontSize:14, marginBottom:24, lineHeight:1.5 }}>
              O sistema leu o arquivo CAD. Selecione abaixo a camada (layer) que contém as paredes para gerá-las automaticamente em 3D.
            </p>

            <div style={{ maxHeight: 300, overflowY: 'auto', background: '#0f172a', borderRadius: 8, padding: 8, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {svgLayers.map(layer => (
                <div key={layer.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {layer.color ? (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: layer.color.replace(/RGB/i, 'rgb'), border: '1px solid rgba(255,255,255,0.1)' }} title={layer.color} />
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#475569', border: '1px solid rgba(255,255,255,0.1)' }} />
                    )}
                    <span style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 500 }}>{layer.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{layer.count} linhas</span>
                    <button
                      onClick={() => importSvgLayerAsWalls(layer.id)}
                      style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
                    >
                      Extrair
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => {
                  svgLayers.forEach(l => importSvgLayerAsWalls(l.id));
                  setShowLayerModal(false);
                }}
                style={{ flex: 1, background: 'linear-gradient(to right, #8b5cf6, #3b82f6)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}
              >
                ✨ Extrair Todo o Projeto para 3D
              </button>

              <button
                onClick={() => setShowLayerModal(false)}
                style={{ width: '30%', background: 'transparent', color: '#cbd5e1', border: '1px solid #475569', borderRadius: 8, padding: '12px 0', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DORI Legend ── */}
      {showDoriLegend && (
        <div style={{
          position: 'absolute', bottom: 20, left: 20, width: 340,
          background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', overflow: 'hidden',
          fontFamily: 'Inter, sans-serif', zIndex: 10
        }}>
          <div style={{ background: '#0f172a', padding: '10px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>Padrão IEC/EN 62676-4: 2015 (MDORI)</span>
            <button onClick={() => setShowDoriLegend(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #334155' }}>
              <span style={{ width: 140 }}>Zonas da Câmera</span>
              <span style={{ width: 50, textAlign: 'right' }}>px/m</span>
              <span style={{ width: 40, textAlign: 'center' }}>Visível</span>
            </div>
            {[
              { name: 'Identificação Superior', px: 1000, color: '#ff69b4' },
              { name: 'Identificação', px: 250, color: '#ef4444' },
              { name: 'Reconhecimento', px: 125, color: '#facc15' },
              { name: 'Observação', px: 62, color: '#22c55e' },
              { name: 'Detecção', px: 25, color: '#06b6d4' },
              { name: 'Monitoramento', px: 12, color: '#3b82f6' }
            ].map((z, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', color: '#cbd5e1', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', width: 140, gap: 8 }}>
                  <div style={{ width: 14, height: 14, background: z.color, opacity: 0.8, borderRadius: 2 }}></div>
                  <span>{z.name}</span>
                </div>
                <span style={{ width: 50, textAlign: 'right', fontFamily: 'monospace' }}>{z.px}</span>
                <span style={{ width: 40, textAlign: 'center', color: '#22c55e' }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Storage Calculator Modal ── */}
      {showCalculator && <StorageCalculator onClose={() => setShowCalculator(false)} />}

    </div>
  );
};

export default FloorPlanEditor;
