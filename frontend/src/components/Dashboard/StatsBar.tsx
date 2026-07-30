import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

const fmt = (n: number, decimals = 2) => n.toFixed(decimals);

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(0,145,218,0.15)', border: '1px solid rgba(0,145,218,0.3)' }}>
      {icon}
    </div>
    <div>
      <div className="text-lg font-semibold text-white leading-tight">{value}</div>
      <div className="text-[11px] text-blue-300/60 leading-none mt-0.5">{label}</div>
    </div>
  </div>
);

const StatsBar = () => {
  const { devices, getTotalBandwidthMbps, getTotalStorageGB } = useProjectStore();
  const bw = getTotalBandwidthMbps();
  const storage = getTotalStorageGB();

  return (
    <div className="flex-shrink-0 px-8 py-3 border-t border-blue-900/40"
      style={{ background: 'linear-gradient(90deg, #071830 0%, #0a2348 50%, #071830 100%)' }}>
      <div className="max-w-5xl mx-auto flex items-center justify-center gap-12">
        <Stat
          value={`${devices.length}`}
          label="elementos no projeto"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#0091da" strokeWidth="1.8" className="w-4 h-4">
              <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>
            </svg>
          }
        />
        <div className="w-px h-8 bg-blue-800/50" />
        <Stat
          value={`${fmt(storage)} GB`}
          label="armazenamento estimado"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#0091da" strokeWidth="1.8" className="w-4 h-4">
              <rect x="2" y="6" width="20" height="12" rx="2"/><line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
          }
        />
        <div className="w-px h-8 bg-blue-800/50" />
        <Stat
          value={`${fmt(bw)} Mbps`}
          label="largura de banda estimada"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#0091da" strokeWidth="1.8" className="w-4 h-4">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
      </div>
    </div>
  );
};

export default StatsBar;
