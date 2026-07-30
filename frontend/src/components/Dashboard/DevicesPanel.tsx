import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

const DevicesPanel = () => {
  const { devices, removeDevice, selectedDeviceId, setSelectedDeviceId, setCatalogOpen } = useProjectStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dispositivos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{devices.length} câmera{devices.length !== 1 ? 's' : ''} no projeto</p>
        </div>
        <button
          onClick={() => setCatalogOpen(true)}
          className="bg-[#0091da] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#007bbf] transition-colors flex items-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Adicionar dispositivo
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-4">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" className="w-8 h-8">
                <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Nenhum dispositivo adicionado</p>
            <p className="text-gray-400 text-sm mt-1">Vá para o mapa e clique em "Adicionar dispositivo"</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="text-left py-2 pb-3 font-medium">Nome</th>
                <th className="text-left py-2 pb-3 font-medium">Modelo</th>
                <th className="text-left py-2 pb-3 font-medium">Resolução</th>
                <th className="text-left py-2 pb-3 font-medium">FPS</th>
                <th className="text-left py-2 pb-3 font-medium">Campo de Visão</th>
                <th className="text-right py-2 pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {devices.map(cam => (
                <tr
                  key={cam.id}
                  onClick={() => setSelectedDeviceId(cam.id === selectedDeviceId ? null : cam.id)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${cam.id === selectedDeviceId ? 'bg-blue-50' : ''}`}
                >
                  <td className="py-3 font-medium text-gray-900">{cam.name}</td>
                  <td className="py-3 text-gray-600">{cam.model}</td>
                  <td className="py-3 text-gray-600">{cam.resolution}</td>
                  <td className="py-3 text-gray-600">{cam.fps} fps</td>
                  <td className="py-3 text-gray-600">{cam.doriRadius}m / {cam.doriAngle}°</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeDevice(cam.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DevicesPanel;
