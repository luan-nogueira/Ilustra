import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

const ZIPSTREAM_LABELS = {
  off: 'Desativada',
  recommended: 'Recomendado',
  max: 'Máximo',
} as const;

const ScenariosPanel = () => {
  const {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    addScenario,
    removeScenario,
    updateScenario,
    getActiveScenario,
  } = useProjectStore();

  const sc = getActiveScenario();
  const zipValues = ['off', 'recommended', 'max'] as const;

  return (
    <div className="flex-shrink-0 border-t border-blue-900/40"
      style={{ background: 'linear-gradient(180deg, #081a36 0%, #0a2045 100%)' }}>
      <div className="max-w-6xl mx-auto flex divide-x divide-blue-900/40">

        {/* Scenarios List */}
        <div className="w-52 py-4 px-4 flex flex-col gap-1 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-blue-300/50 uppercase tracking-widest">Cenários</span>
            <button
              onClick={addScenario}
              className="text-[#00c6ff] hover:text-white transition-colors"
              title="Adicionar cenário"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>
          </div>

          {scenarios.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveScenarioId(s.id)}
              className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-all text-sm ${
                s.id === activeScenarioId
                  ? 'text-white font-semibold'
                  : 'text-blue-300/60 hover:text-blue-100'
              }`}
              style={s.id === activeScenarioId ? { background: 'rgba(0,145,218,0.3)', border: '1px solid rgba(0,198,255,0.3)' } : {}}
            >
              <span className="truncate">{s.name}</span>
              {scenarios.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeScenario(s.id); }}
                  className="opacity-0 group-hover:opacity-100 ml-1 text-blue-400/50 hover:text-red-400 transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Zipstream Config */}
        <div className="flex-1 py-4 px-8">
          <h4 className="text-[10px] font-bold text-blue-300/50 uppercase tracking-widest mb-3">
            Zipstream — {sc.name}
          </h4>

          <div className="flex rounded-lg p-1 w-fit mb-3"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {zipValues.map((val) => (
              <button
                key={val}
                onClick={() => updateScenario(sc.id, { zipstreamLevel: val })}
                className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
                  sc.zipstreamLevel === val
                    ? 'text-blue-900 shadow-sm'
                    : 'text-blue-300/60 hover:text-blue-200'
                }`}
                style={sc.zipstreamLevel === val ? { background: 'linear-gradient(135deg, #0091da, #00c6ff)' } : {}}
              >
                {ZIPSTREAM_LABELS[val]}
              </button>
            ))}
          </div>

          <p className="text-xs text-blue-300/50 leading-relaxed max-w-sm">
            {sc.zipstreamLevel === 'off' && 'Sem compressão inteligente. Maior qualidade de imagem, maior consumo de armazenamento.'}
            {sc.zipstreamLevel === 'recommended' && 'Excelente qualidade com economia de até 40% no armazenamento. Recomendado para a maioria dos projetos.'}
            {sc.zipstreamLevel === 'max' && 'Economia máxima de até 65% no armazenamento. Pode haver redução de detalhe em cenas de baixa movimentação.'}
          </p>
        </div>

        {/* Retention Days */}
        <div className="w-52 py-4 px-6 flex flex-col items-center justify-center flex-shrink-0">
          <h4 className="text-[10px] font-bold text-blue-300/50 uppercase tracking-widest mb-3 text-center">
            Retenção
          </h4>
          <div className="flex items-center gap-4">
            <button
              onClick={() => updateScenario(sc.id, { retentionDays: Math.max(1, sc.retentionDays - 1) })}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-blue-700/50 text-blue-300/60 hover:border-[#00c6ff] hover:text-[#00c6ff] transition-all active:scale-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div className="text-center">
              <div className="text-4xl font-light text-white leading-none">{sc.retentionDays}</div>
              <div className="text-[11px] text-blue-300/50 mt-1">dias</div>
            </div>
            <button
              onClick={() => updateScenario(sc.id, { retentionDays: sc.retentionDays + 1 })}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-blue-700/50 text-blue-300/60 hover:border-[#00c6ff] hover:text-[#00c6ff] transition-all active:scale-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>

        {/* Schedules */}
        <div className="w-64 py-4 px-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-bold text-blue-300/50 uppercase tracking-widest">Agendamentos</h4>
            <button className="text-[#00c6ff] hover:text-white transition-colors" title="Adicionar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 rounded-lg p-3"
            style={{ background: 'rgba(0,145,218,0.12)', border: '1px solid rgba(0,145,218,0.25)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,145,218,0.2)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#00c6ff" strokeWidth="1.8" className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-white">Horário comercial</div>
              <div className="text-xs text-blue-300/50">Seg.–Sex., 08:00–17:00</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScenariosPanel;
