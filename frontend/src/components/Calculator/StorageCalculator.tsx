import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export const StorageCalculator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { sceneObjects } = useProjectStore();
  const cameras = sceneObjects.filter(o => o.type === 'camera');

  const [fps, setFps] = useState(15);
  const [days, setDays] = useState(30);
  const [codec, setCodec] = useState<'H.264' | 'H.265'>('H.265');
  const [hoursPerDay, setHoursPerDay] = useState(24);

  // Approximate bitrates (Mbps) for 1080p as a base
  // H.264 @ 15fps ~ 2.0 Mbps
  // H.265 @ 15fps ~ 1.0 Mbps
  const getBitrate = (cam: any) => {
    let base = codec === 'H.265' ? 1.0 : 2.0;
    
    // Scale by FPS
    base = base * (fps / 15);
    
    // Scale by Resolution (Approximate: 2MP = 1, 4MP = 1.5, 8MP = 2.5)
    let resMult = 1.0;
    if (cam.resolution === '4MP') resMult = 1.5;
    if (cam.resolution === '8MP') resMult = 2.5;

    return base * resMult;
  };

  const totalMbps = cameras.reduce((acc, cam) => acc + getBitrate(cam), 0);
  
  // TB = Mbps * (1/8) MBps * 3600 * hoursPerDay * days / 1,000,000
  const totalTB = (totalMbps * 0.125 * 3600 * hoursPerDay * days) / 1000000;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15,23,42,0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#1e293b', padding: 32, borderRadius: 16, border: '1px solid #334155',
        width: 600, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: 20 }}>💾 Calculadora de Banda e Storage</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 24 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Compressão (Codec)</label>
            <select value={codec} onChange={e => setCodec(e.target.value as any)} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 8 }}>
              <option value="H.264">H.264 (Legado)</option>
              <option value="H.265">H.265 (Alta Eficiência)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Frames por Segundo (FPS)</label>
            <select value={fps} onChange={e => setFps(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 8 }}>
              <option value={10}>10 FPS</option>
              <option value={15}>15 FPS (Recomendado)</option>
              <option value={20}>20 FPS</option>
              <option value={30}>30 FPS</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Dias de Retenção</label>
            <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Horas de Gravação por Dia</label>
            <input type="number" value={hoursPerDay} onChange={e => setHoursPerDay(Number(e.target.value))} max={24} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 8, padding: 16, border: '1px solid #334155', marginBottom: 24 }}>
          <h3 style={{ color: '#cbd5e1', fontSize: 14, margin: '0 0 12px 0' }}>Resumo do Projeto ({cameras.length} Câmeras)</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #1e293b' }}>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>Tráfego de Rede Estimado:</span>
            <span style={{ color: '#38bdf8', fontSize: 24, fontWeight: 700 }}>{totalMbps.toFixed(1)} Mbps</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>Armazenamento Necessário:</span>
            <span style={{ color: '#22c55e', fontSize: 24, fontWeight: 700 }}>{totalTB.toFixed(2)} TB</span>
          </div>
        </div>

        <button onClick={onClose} style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, cursor: 'pointer' }}>
          Concluir
        </button>
      </div>
    </div>
  );
};
