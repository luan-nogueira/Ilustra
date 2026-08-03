import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { CameraFeedCanvas } from './CameraFeedCanvas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CameraGridModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { sceneObjects } = useProjectStore();
  const [gridSize, setGridSize] = useState<1 | 2 | 3 | 4>(3); // 1x1, 2x2, 3x3, 4x4
  const [fullscreenCamId, setFullscreenCamId] = useState<string | null>(null);

  if (!isOpen) return null;

  const cameras = sceneObjects.filter(o => o.type === 'camera');

  const totalSlots = gridSize * gridSize;
  const gridColsClass = 
    gridSize === 1 ? 'grid-cols-1' :
    gridSize === 2 ? 'grid-cols-2' :
    gridSize === 3 ? 'grid-cols-3' : 'grid-cols-4';

  const gridSlots = Array.from({ length: totalSlots }, (_, i) => cameras[i] || null);

  const selectedCamForFS = fullscreenCamId ? cameras.find(c => c.id === fullscreenCamId) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 text-white animate-fadeIn">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-lg font-semibold tracking-wide">Simulador de Central VMS — Monitoramento Multi-Câmeras</h2>
          <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full font-mono">
            {cameras.length} Câmeras Ativas
          </span>
        </div>

        {/* Matrix Grid Size Selectors */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700">
            <span className="text-xs text-gray-400 font-medium px-2">Grilla:</span>
            {([1, 2, 3, 4] as const).map(size => (
              <button
                key={size}
                onClick={() => { setGridSize(size); setFullscreenCamId(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  gridSize === size && !fullscreenCamId
                    ? 'bg-[#0F62FE] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {size}x{size}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Fechar Central VMS"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 p-4 overflow-hidden bg-black/90">
        {selectedCamForFS ? (
          /* Fullscreen Single Camera Mode */
          <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden border border-gray-800 flex flex-col">
            <div className="flex justify-between items-center px-4 py-2 bg-black/60 backdrop-blur-md absolute top-0 left-0 right-0 z-10">
              <span className="font-semibold text-sm text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"/>
                {selectedCamForFS.model || 'Illustra IP Camera'} ({selectedCamForFS.id})
              </span>
              <button
                onClick={() => setFullscreenCamId(null)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
              >
                Voltar para Grilla {gridSize}x{gridSize}
              </button>
            </div>
            
            {/* Live 3D point-of-view feed, rendered from this camera's real position/height/tilt/FOV */}
            <div className="flex-1 relative bg-black overflow-hidden">
              <CameraFeedCanvas camObj={selectedCamForFS} />
              <div className="absolute inset-x-0 top-10 flex justify-center pointer-events-none">
                <span className="font-mono text-xs text-sky-300 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                  STREAM HD H.265 • 30 FPS • 4.2 Mbps
                </span>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-gray-400 font-mono bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none">
                Posição X:{selectedCamForFS.position[0].toFixed(1)}m | Y:{selectedCamForFS.position[2].toFixed(1)}m | Altura:{selectedCamForFS.position[1].toFixed(1)}m | Tilt:{selectedCamForFS.tilt ?? 15}°
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Camera Grid Matrix */
          <div className={`grid ${gridColsClass} gap-3 h-full`}>
            {gridSlots.map((cam, idx) => (
              <div
                key={cam ? cam.id : `empty-${idx}`}
                className="relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col group hover:border-sky-500/50 transition-all"
              >
                {cam ? (
                  <>
                    {/* Header overlay */}
                    <div className="absolute top-0 left-0 right-0 px-3 py-1.5 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center text-xs">
                      <span className="font-medium text-emerald-400 truncate max-w-[70%]">
                        {cam.model || `Câmera #${idx + 1}`}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded">
                        {cam.resolution || '1080p'}
                      </span>
                    </div>

                    {/* Live 3D point-of-view feed for this camera tile */}
                    <div
                      onClick={() => setFullscreenCamId(cam.id)}
                      className="flex-1 cursor-pointer relative overflow-hidden bg-black"
                    >
                      <CameraFeedCanvas camObj={cam} />

                      {/* Click to expand hover hint */}
                      <div className="absolute inset-0 bg-sky-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-xs font-semibold bg-sky-600 text-white px-3 py-1 rounded-md shadow-md">
                          Expandir Câmera
                        </span>
                      </div>
                    </div>

                    {/* Footer telemetry */}
                    <div className="px-3 py-1 bg-black/80 border-t border-gray-800/60 flex justify-between items-center text-[10px] text-gray-400 font-mono">
                      <span>FOV: {cam.fov || 90}°</span>
                      <span className="text-emerald-400">REC ●</span>
                      <span>25 FPS</span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-700 bg-gray-950/50">
                    <svg className="w-8 h-8 mb-1 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className="text-xs font-medium text-gray-600">Canal Livre</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
