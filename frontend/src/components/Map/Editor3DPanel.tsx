import React, { useState } from 'react';
import { useProjectStore, SceneObjectType, SceneObject } from '../../store/useProjectStore';
import { CAMERA_CATALOG } from '../Dashboard/CatalogModal';
import { v4 as uuidv4 } from 'uuid';

// ─── Camera color by model ─────────────────────────────────────────
const CAM_COLOR_MAP: Record<string, string> = {
  'Illustra Pro 4MP':     '#00d2ff',
  'Illustra Pro 8MP 4K':  '#f6c90e',
  'Illustra Flex 2MP':    '#a3e635',
  'Illustra Radar':       '#ff6b6b',
};

// ─── Non-camera items ──────────────────────────────────────────────
const STRUCTURE_ITEMS: { type: SceneObjectType; label: string; color: string; icon: string }[] = [
  { type: 'wall',   label: 'Parede',  color: '#e8e8e8', icon: '🧱' },
  { type: 'column', label: 'Coluna',  color: '#d0d0d0', icon: '🏛️' },
  { type: 'table',  label: 'Mesa',    color: '#c8a96e', icon: '🪵' },
  { type: 'chair',  label: 'Cadeira', color: '#718096', icon: '🪑' },
  { type: 'sofa',   label: 'Sofá',    color: '#e53e3e', icon: '🛋️' },
  { type: 'bed',    label: 'Cama',    color: '#74b9ff', icon: '🛏️' },
  { type: 'person', label: 'Pessoa',  color: '#ffb6c1', icon: '🧍' },
];

export const Editor3DPanel = () => {
  const { addSceneObject, selectedSceneObjectId, removeSceneObject, sceneObjects } = useProjectStore();
  const [showCameraPicker, setShowCameraPicker] = useState(false);

  const selectedObj = sceneObjects.find(o => o.id === selectedSceneObjectId) ?? null;

  const handleAddStructure = (item: typeof STRUCTURE_ITEMS[0]) => {
    addSceneObject({
      id: uuidv4(),
      type: item.type,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: item.color,
    } as SceneObject);
  };

  const handleAddCamera = (model: typeof CAMERA_CATALOG[0]) => {
    addSceneObject({
      id: uuidv4(),
      type: 'camera',
      position: [0, 2.8, 0],
      rotation: [-0.4, 0, 0],
      scale: [1, 1, 1],
      color: CAM_COLOR_MAP[model.model] ?? '#00d2ff',
      fov: model.doriAngle,
      range: Math.min(model.doriRadius / 5, 30), // scale to scene units
    } as SceneObject);
    setShowCameraPicker(false);
  };

  return (
    <div className="absolute top-4 left-4 z-[500] flex flex-col gap-3 pointer-events-none" style={{ maxHeight: 'calc(100% - 32px)', overflowY: 'auto' }}>

      {/* ── Element Catalogue ────────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-200 p-4 pointer-events-auto w-64">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Estruturas & Mobiliário</h3>
        <div className="grid grid-cols-3 gap-2">
          {STRUCTURE_ITEMS.map(item => (
            <button
              key={item.type}
              onClick={() => handleAddStructure(item)}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[9px] font-semibold text-gray-600">{item.label}</span>
            </button>
          ))}
        </div>

        {/* ── Camera Section ──────────────────────────────────────── */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Câmeras de Segurança</h3>

          {!showCameraPicker ? (
            <button
              onClick={() => setShowCameraPicker(true)}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-gradient-to-r from-[#0091da] to-[#00bcd4] text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md"
            >
              <span>📹</span>
              <span>Adicionar Câmera</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">Selecione o modelo</span>
                <button onClick={() => setShowCameraPicker(false)} className="text-gray-400 hover:text-gray-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {CAMERA_CATALOG.map(cam => (
                <button
                  key={cam.model}
                  onClick={() => handleAddCamera(cam)}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                    style={{ background: CAM_COLOR_MAP[cam.model] ?? '#00d2ff', ringColor: CAM_COLOR_MAP[cam.model] ?? '#00d2ff' }}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-gray-800 truncate">{cam.model}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{cam.type}</span>
                      <span className="text-[9px] text-gray-500">{cam.doriAngle}° FOV</span>
                      <span className="text-[9px] text-gray-500">{cam.doriRadius}m</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Selected Object Info ─────────────────────────────────── */}
      {selectedObj && (
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-200 p-4 pointer-events-auto w-64">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Objeto Selecionado</h3>
            <button
              onClick={() => removeSceneObject(selectedObj.id)}
              className="text-[10px] text-red-500 hover:text-white font-semibold bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 px-2 py-1 rounded transition-all"
            >
              Remover
            </button>
          </div>

          {selectedObj.type === 'camera' && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-500">Ângulo FOV</span>
                <span className="text-[11px] font-bold text-[#0091da]">{selectedObj.fov ?? 75}°</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-500">Alcance</span>
                <span className="text-[11px] font-bold text-[#0091da]">~{Math.round((selectedObj.range ?? 15) * 5)}m reais</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: selectedObj.color }} />
                <span className="text-[10px] text-gray-400">Cor do cone de visão</span>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
            Use as <strong>setas coloridas</strong> no ambiente 3D para mover este objeto livremente pelo espaço.
          </p>
        </div>
      )}
    </div>
  );
};
