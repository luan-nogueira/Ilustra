import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useProjectStore, type CameraDevice } from '../../store/useProjectStore';
import { FloorPlan3D } from '../Map/FloorPlan3D';
import { Editor3DPanel } from '../Map/Editor3DPanel';

// ── Canvas rendering ──────────────────────────────────────────────

interface CanvasCamera {
  id: string;
  name: string;
  x: number; // canvas pixels
  y: number;
  rotation: number; // degrees
  doriAngle: number;
  doriRadius: number; // canvas pixels (scaled)
}

const drawFloorPlan = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  image: HTMLImageElement | null,
  cameras: CanvasCamera[],
  selectedId: string | null,
  showBlindSpots: boolean,
  perspective: number
) => {
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);

  // Draw floor plan image
  if (image) {
    ctx.globalAlpha = 0.95;
    ctx.drawImage(image, 0, 0, width, height);
    ctx.globalAlpha = 1;
  } else {
    // Grid background
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    // Center label
    ctx.fillStyle = '#ccc';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Arraste uma planta baixa aqui ou use o botão de upload', width / 2, height / 2);
  }

  // Blind spot analysis grid
  if (showBlindSpots && cameras.length > 0) {
    const cellSize = 10;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;

        let covered = false;
        for (const cam of cameras) {
          const dx = cx - cam.x;
          const dy = cy - cam.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > cam.doriRadius) continue;

          let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          angle = ((angle % 360) + 360) % 360;
          let camRot = ((cam.rotation % 360) + 360) % 360;
          let diff = Math.abs(angle - camRot);
          if (diff > 180) diff = 360 - diff;

          if (diff <= cam.doriAngle / 2) {
            covered = true;
            break;
          }
        }

        ctx.fillStyle = covered ? 'rgba(0,180,80,0.18)' : 'rgba(220,40,40,0.12)';
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }

  // Draw cones
  for (const cam of cameras) {
    const isSelected = cam.id === selectedId;
    const startAngle = ((cam.rotation - cam.doriAngle / 2 - 90) * Math.PI) / 180;
    const endAngle = ((cam.rotation + cam.doriAngle / 2 - 90) * Math.PI) / 180;

    // Cone fill
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.arc(cam.x, cam.y, cam.doriRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = isSelected ? 'rgba(0,145,218,0.25)' : 'rgba(255,204,0,0.25)';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#0091da' : '#c8a800';
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.stroke();

    // Camera dot
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, isSelected ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#0091da' : '#fff';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#005f91' : '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#fff' : '#333';
    ctx.fill();

    // Label
    ctx.fillStyle = '#333';
    ctx.font = `${isSelected ? 'bold ' : ''}11px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(cam.name, cam.x, cam.y + 20);
  }
};

// ── Coverage stats ─────────────────────────────────────────────────
const calcCoverage = (cameras: CanvasCamera[], width: number, height: number): number => {
  if (cameras.length === 0) return 0;
  const cellSize = 12;
  let total = 0, covered = 0;
  for (let row = 0; row < height; row += cellSize) {
    for (let col = 0; col < width; col += cellSize) {
      total++;
      const cx = col + cellSize / 2;
      const cy = row + cellSize / 2;
      for (const cam of cameras) {
        const dx = cx - cam.x;
        const dy = cy - cam.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > cam.doriRadius) continue;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        angle = ((angle % 360) + 360) % 360;
        let camRot = ((cam.rotation % 360) + 360) % 360;
        let diff = Math.abs(angle - camRot);
        if (diff > 180) diff = 360 - diff;
        if (diff <= cam.doriAngle / 2) { covered++; break; }
      }
    }
  }
  return total > 0 ? Math.round((covered / total) * 100) : 0;
};

// ── Component ──────────────────────────────────────────────────────
const FloorPlanView = () => {
  const {
    devices,
    floorPlanImage,
    setFloorPlanImage,
    selectedDeviceId,
    setSelectedDeviceId,
    updateDeviceProps,
  } = useProjectStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [showBlindSpots, setShowBlindSpots] = useState(true);
  const [perspective, setPerspective] = useState(0); // 0 = top-down, 1-45 = angle
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 520 });
  const [is3DMode, setIs3DMode] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const RADIUS_SCALE = 0.4; // meters to canvas px (adjust to taste)

  // Convert devices to canvas cameras
  const cameras: CanvasCamera[] = devices.map((d, i) => ({
    id: d.id,
    name: d.name.split(' ').slice(0, 2).join(' '),
    x: 120 + (i % 4) * 180,
    y: 120 + Math.floor(i / 4) * 180,
    rotation: d.rotation,
    doriAngle: d.doriAngle,
    doriRadius: d.doriRadius * RADIUS_SCALE,
  }));

  // Camera positions overridden by drag
  const [camPositions, setCamPositions] = useState<Record<string, { x: number; y: number }>>({});

  const finalCameras = cameras.map(c => ({
    ...c,
    x: camPositions[c.id]?.x ?? c.x,
    y: camPositions[c.id]?.y ?? c.y,
  }));

  const coverage = calcCoverage(finalCameras, canvasSize.w, canvasSize.h);

  // Load image when floorPlanImage changes
  useEffect(() => {
    if (!floorPlanImage) { setImgEl(null); return; }
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = floorPlanImage;
  }, [floorPlanImage]);

  // Draw on every change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFloorPlan(ctx, canvasSize.w, canvasSize.h, imgEl, finalCameras, selectedDeviceId, showBlindSpots, perspective);
  }, [imgEl, finalCameras, selectedDeviceId, showBlindSpots, perspective, canvasSize]);

  // Handle file upload
  const handleFile = useCallback(async (file: File) => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      setIsConverting(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 }); // Escala 2x para melhor resolução
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          setFloorPlanImage(canvas.toDataURL('image/png'));
        }
      } catch (err) {
        console.error("Erro ao carregar PDF:", err);
        alert("Ocorreu um erro ao renderizar o PDF.");
      }
      setIsConverting(false);
    } 
    else if (fileName.endsWith('.dwg')) {
      setIsConverting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('http://localhost:8000/api/v1/convert-dwg', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Erro na conversão no servidor backend');
        const data = await res.json();
        
        // Carrega a imagem antes de setar para garantir que o link funciona
        const img = new Image();
        img.onload = () => setFloorPlanImage(data.url);
        img.onerror = () => alert("Erro ao carregar a imagem convertida");
        img.src = data.url;
      } catch (err) {
        console.error("Erro ao converter DWG:", err);
        alert("Erro ao converter DWG. Certifique-se de que o backend (porta 8000) está rodando e configurado com a API Key.");
      }
      setIsConverting(false);
    } 
    else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFloorPlanImage(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      alert("Formato não suportado. Envie uma Imagem, PDF ou DWG.");
    }
  }, [setFloorPlanImage]);

  // Canvas mouse events for drag
  const getHitCamera = (x: number, y: number) => {
    for (const cam of [...finalCameras].reverse()) {
      const dx = x - cam.x;
      const dy = y - cam.y;
      if (Math.sqrt(dx * dx + dy * dy) < 14) return cam.id;
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const hit = getHitCamera(x, y);
    if (hit) {
      setSelectedDeviceId(hit);
      setDragging(hit);
    } else {
      setSelectedDeviceId(null);
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvasSize.w, (e.clientX - rect.left) / scale));
    const y = Math.max(0, Math.min(canvasSize.h, (e.clientY - rect.top) / scale));
    setCamPositions(prev => ({ ...prev, [dragging]: { x, y } }));
  };

  const onMouseUp = () => setDragging(null);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f5]">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center gap-4 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-800 mr-2">Planta Baixa</h2>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isConverting}
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors text-white ${isConverting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0091da] hover:bg-[#007bbf]'}`}
        >
          {isConverting ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
          {isConverting ? 'Processando...' : 'Carregar planta'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.dwg" className="hidden" onChange={e => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
          e.target.value = ''; // reseta o input
        }} />

        {floorPlanImage && (
          <button onClick={() => setFloorPlanImage(null)} className="text-xs text-gray-500 hover:text-red-500 transition-colors">
            Remover planta
          </button>
        )}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setShowBlindSpots(v => !v)}
            className={`w-9 h-5 rounded-full transition-colors relative ${showBlindSpots ? 'bg-[#0091da]' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showBlindSpots ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs font-medium text-gray-600">Pontos cegos</span>
        </label>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Perspective slider / 3D toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Vista 2D</span>
          <div
            onClick={() => setIs3DMode(v => !v)}
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${is3DMode ? 'bg-[#0091da]' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${is3DMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-gray-500 font-semibold text-[#0091da]">Ambiente 3D</span>
        </div>

        {/* Coverage badge */}
        {devices.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-400 opacity-70" />
              <span className="text-xs text-gray-500">Coberto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-400 opacity-70" />
              <span className="text-xs text-gray-500">Ponto cego</span>
            </div>
            <div className="ml-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">
              <span className="text-xs font-semibold text-[#0091da]">{coverage}% coberto</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main canvas area */}
        {is3DMode ? (
          <div className="flex-1 w-full h-full relative">
            <Editor3DPanel />
            <FloorPlan3D />
          </div>
        ) : (
          <>
            <div
              className="flex-1 overflow-auto flex items-center justify-center p-6"
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <div
                className={`relative transition-all duration-300 shadow-2xl rounded-lg overflow-hidden ${isDragOver ? 'ring-4 ring-[#0091da] ring-offset-2' : ''}`}
                style={{
                  transform: `perspective(1200px) rotateX(${perspective}deg)`,
                  transformOrigin: 'center top',
                }}
              >
                {isConverting && (
                  <div className="absolute inset-0 bg-white/70 z-50 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[#0091da] border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-sm font-semibold text-[#0091da]">Processando arquivo...</span>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  width={canvasSize.w}
                  height={canvasSize.h}
                  className="block cursor-crosshair"
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                />
                {isDragOver && (
                  <div className="absolute inset-0 bg-[#0091da]/20 flex items-center justify-center pointer-events-none">
                    <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-center">
                      <p className="text-[#0091da] font-semibold">Solte para carregar a planta</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: selected camera props */}
            {selectedDevice && (
              <div className="w-64 bg-white border-l border-gray-200 p-4 flex-shrink-0 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-800">Câmera selecionada</h3>
                  <button onClick={() => setSelectedDeviceId(null)} className="text-gray-400 hover:text-gray-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-800">{selectedDevice.name}</div>
                  <div className="text-xs text-gray-500">{selectedDevice.model}</div>
                </div>

                {[
                  { label: 'Direção', key: 'rotation' as const, min: 0, max: 359, step: 1, unit: '°' },
                  { label: 'Ângulo FOV', key: 'doriAngle' as const, min: 10, max: 180, step: 1, unit: '°' },
                  { label: 'Alcance', key: 'doriRadius' as const, min: 10, max: 1000, step: 5, unit: 'm' },
                ].map(({ label, key, min, max, step, unit }) => (
                  <div key={key} className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-600">{label}</span>
                      <span className="text-xs font-semibold text-[#0091da]">{selectedDevice[key]}{unit}</span>
                    </div>
                    <input
                      type="range" min={min} max={max} step={step} value={selectedDevice[key]}
                      onChange={e => updateDeviceProps(selectedDevice.id, { [key]: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #0091da ${((selectedDevice[key] - min) / (max - min)) * 100}%, #e5e7eb ${((selectedDevice[key] - min) / (max - min)) * 100}%)` }}
                    />
                  </div>
                ))}

                <div className="mt-4 bg-gray-50 rounded-lg p-3 flex justify-center">
                  <svg viewBox="-100 -100 200 200" className="w-24 h-24">
                    {(() => {
                      const a = selectedDevice.doriAngle;
                      const r = 85;
                      const rot = selectedDevice.rotation - 90;
                      const s = ((rot - a / 2) * Math.PI) / 180;
                      const en = ((rot + a / 2) * Math.PI) / 180;
                      const x1 = Math.cos(s) * r, y1 = Math.sin(s) * r;
                      const x2 = Math.cos(en) * r, y2 = Math.sin(en) * r;
                      return <>
                        <path d={`M0 0 L${x1} ${y1} A${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${x2} ${y2}Z`} fill="#0091da" fillOpacity={0.22} stroke="#0091da" strokeWidth="1.5"/>
                        <circle cx="0" cy="0" r="7" fill="#003865"/>
                      </>;
                    })()}
                  </svg>
                </div>

                <p className="text-[10px] text-gray-400 text-center mt-2">
                  Arraste a câmera na planta para reposicioná-la
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Instructions when no cameras */}
      {devices.length === 0 && !is3DMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-6 py-4 shadow-md text-center">
            <p className="text-gray-500 text-sm">Adicione câmeras na aba <strong>Visão Geral do Projeto</strong> para visualizá-las na planta baixa.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloorPlanView;
