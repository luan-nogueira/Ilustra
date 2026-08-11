import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

import rawCameras from '../../data/cameras.json';

export const CAMERA_CATALOG = rawCameras.map(cam => ({
  model: cam.model,
  type: 'Câmera IP',
  resolution: cam.resolution as any,
  fps: cam.fps as any,
  doriRadius: cam.range,
  doriAngle: cam.fov,
  description: `Câmera ${cam.model} com compressão ${cam.compression || 'padrão'}. Alcance de IR/DORI: ${cam.range}m.`,
  icon: '🎥',
}));

const CatalogModal = () => {
  const { isCatalogOpen, setCatalogOpen, addDevice, devices } = useProjectStore();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const mapCenter = { lat: -23.5505, lng: -46.6333 };

  const handleAdd = () => {
    const cam = CAMERA_CATALOG.find(c => c.model === selectedModel);
    if (!cam) return;
    const id = `cam-${Date.now()}`;
    const offset = devices.length * 0.0003;
    addDevice({
      id,
      name: `${cam.model} (${devices.length + 1})`,
      model: cam.model,
      resolution: cam.resolution,
      fps: cam.fps,
      lat: mapCenter.lat + offset,
      lng: mapCenter.lng + offset,
      rotation: 0,
      doriRadius: cam.doriRadius,
      doriAngle: cam.doriAngle,
    });
    setCatalogOpen(false);
    setSelectedModel(null);
  };

  if (!isCatalogOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCatalogOpen(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[680px] max-h-[80vh] flex flex-col overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Adicionar dispositivo</h2>
            <p className="text-sm text-gray-500 mt-0.5">Selecione o modelo de câmera C-CURE compatível</p>
          </div>
          <button onClick={() => setCatalogOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-2 gap-4">
          {CAMERA_CATALOG.map(cam => (
            <button
              key={cam.model}
              onClick={() => setSelectedModel(cam.model)}
              className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${selectedModel === cam.model ? 'border-[#0091da] bg-blue-50 shadow-md' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{cam.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{cam.model}</div>
                  <div className="text-xs text-[#0091da] font-medium mt-0.5">{cam.type}</div>
                  <div className="text-xs text-gray-500 mt-2 leading-relaxed">{cam.description}</div>
                  <div className="flex gap-3 mt-3">
                    <span className="text-xs bg-gray-200 text-gray-600 rounded px-2 py-0.5">{cam.resolution}</span>
                    <span className="text-xs bg-gray-200 text-gray-600 rounded px-2 py-0.5">{cam.fps} fps</span>
                    <span className="text-xs bg-gray-200 text-gray-600 rounded px-2 py-0.5">{cam.doriRadius}m</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={() => setCatalogOpen(false)} className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
          <button
            onClick={handleAdd}
            disabled={!selectedModel}
            className="px-5 py-2 text-sm font-medium bg-[#0091da] text-white rounded-lg hover:bg-[#007bbf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Adicionar ao mapa
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogModal;
