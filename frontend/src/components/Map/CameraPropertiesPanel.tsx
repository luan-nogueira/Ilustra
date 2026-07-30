import React from 'react';
import { useProjectStore, type CameraDevice } from '../../store/useProjectStore';

interface Props {
  device: CameraDevice;
}

const SliderRow = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <span className="text-xs font-semibold text-[#0091da] tabular-nums w-16 text-right">
        {value}{unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, #0091da ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%)`,
      }}
    />
    <div className="flex justify-between mt-0.5">
      <span className="text-[10px] text-gray-300">{min}{unit}</span>
      <span className="text-[10px] text-gray-300">{max}{unit}</span>
    </div>
  </div>
);

const CameraPropertiesPanel: React.FC<Props> = ({ device }) => {
  const { updateDeviceProps, removeDevice, setSelectedDeviceId } = useProjectStore();

  const update = (patch: Partial<Pick<CameraDevice, 'rotation' | 'doriAngle' | 'doriRadius'>>) => {
    updateDeviceProps(device.id, patch);
  };

  return (
    <div className="absolute right-4 top-4 z-[500] w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003865] to-[#0091da] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
          <div>
            <div className="text-white text-xs font-semibold truncate max-w-[130px]">{device.name}</div>
            <div className="text-white/70 text-[10px]">{device.model}</div>
          </div>
        </div>
        <button
          onClick={() => setSelectedDeviceId(null)}
          className="text-white/60 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
          Ajuste do Cone de Visão
        </p>

        <SliderRow
          label="Direção (Rotação)"
          value={device.rotation}
          min={0}
          max={359}
          step={1}
          unit="°"
          onChange={(v) => update({ rotation: v })}
        />

        <SliderRow
          label="Ângulo de Abertura (FOV)"
          value={device.doriAngle}
          min={10}
          max={180}
          step={1}
          unit="°"
          onChange={(v) => update({ doriAngle: v })}
        />

        <SliderRow
          label="Alcance (Raio)"
          value={device.doriRadius}
          min={10}
          max={1000}
          step={5}
          unit="m"
          onChange={(v) => update({ doriRadius: v })}
        />

        {/* Visual preview */}
        <div className="mt-3 bg-gray-50 rounded-lg p-3 flex items-center justify-center">
          <svg viewBox="-110 -110 220 220" className="w-28 h-28">
            {/* Cone preview */}
            {(() => {
              const a = device.doriAngle;
              const r = 90;
              const rot = device.rotation - 90;
              const startA = ((rot - a / 2) * Math.PI) / 180;
              const endA = ((rot + a / 2) * Math.PI) / 180;
              const x1 = Math.cos(startA) * r;
              const y1 = Math.sin(startA) * r;
              const x2 = Math.cos(endA) * r;
              const y2 = Math.sin(endA) * r;
              const large = a > 180 ? 1 : 0;
              return (
                <>
                  <path
                    d={`M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                    fill="#0091da"
                    fillOpacity={0.2}
                    stroke="#0091da"
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy="0" r="6" fill="#003865" />
                </>
              );
            })()}
          </svg>
        </div>

        <div className="mt-3 text-[10px] text-gray-400 text-center">
          Arraste a câmera no mapa para reposicioná-la
        </div>

        {/* Delete */}
        <button
          onClick={() => { removeDevice(device.id); setSelectedDeviceId(null); }}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Excluir dispositivo
        </button>
      </div>
    </div>
  );
};

export default CameraPropertiesPanel;
