import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

const Topbar = () => {
  const { projectName, setProjectName, setCameraGridOpen, setStorageCalcOpen } = useProjectStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed) setProjectName(trimmed);
    else setDraft(projectName);
    setEditing(false);
  };

  return (
    <div className="h-14 flex items-center justify-between px-5 shrink-0 z-20 border-b border-white/5"
      style={{ background: '#0B1121' }}>

      {/* Left: back + project name */}
      <div className="flex items-center gap-3">
        <button className="text-blue-400/60 hover:text-blue-300 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') { setDraft(projectName); setEditing(false); }
            }}
            className="text-base font-medium text-white border-b-2 border-[#00c6ff] outline-none bg-transparent px-1 min-w-0 w-48"
          />
        ) : (
          <button
            onClick={() => { setDraft(projectName); setEditing(true); }}
            className="flex items-center gap-2 group"
          >
            <span className="text-base font-medium text-white">{projectName}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="#4da8d8" strokeWidth="2" className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Center: Software branding */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 select-none">
        {/* Logo mark */}
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20"
          style={{ background: 'linear-gradient(135deg, #0F62FE, #4589FF)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" className="w-4 h-4">
            <polygon points="12 2 22 20 2 20"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
          </svg>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="font-black text-[17px] tracking-tight"
            style={{ color: '#ffffff' }}
          >
            Illustra
          </span>
          <span className="text-blue-300/50 text-[13px] font-light tracking-wider">Design</span>
        </div>

        <div className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider text-blue-100 bg-[#0F62FE] shadow-sm shadow-[#0F62FE]/30 border border-blue-400/20">ENTERPRISE</div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Save / Load Buttons */}
        <div className="flex items-center gap-2 mr-2">
          <label title="Importar Projeto (.json)" className="cursor-pointer text-blue-400/60 hover:text-white transition-colors bg-[#0f274a] hover:bg-[#1a3a6a] px-3 py-1.5 rounded-md flex items-center gap-2 border border-blue-900/50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="text-xs font-medium">Abrir</span>
            <input type="file" accept=".json" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  const data = JSON.parse(ev.target?.result as string);
                  if (data.walls) useProjectStore.setState({ walls: data.walls });
                  if (data.sceneObjects) useProjectStore.setState({ sceneObjects: data.sceneObjects });
                  if (data.projectName) useProjectStore.setState({ projectName: data.projectName });
                } catch (err) {
                  alert("Erro ao ler o arquivo do projeto.");
                }
              };
              reader.readAsText(file);
              e.target.value = ''; // reset
            }} />
          </label>

          <button title="Exportar Projeto (.json)" className="text-blue-400/60 hover:text-white transition-colors bg-[#0f274a] hover:bg-[#1a3a6a] px-3 py-1.5 rounded-md flex items-center gap-2 border border-blue-900/50"
            onClick={() => {
              const state = useProjectStore.getState();
              const data = JSON.stringify({
                projectName: state.projectName,
                walls: state.walls,
                sceneObjects: state.sceneObjects
              }, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${state.projectName || 'projeto'}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span className="text-xs font-medium">Salvar</span>
          </button>
        </div>

        {/* Action Shortcuts: VMS Grid & Storage Calculator */}
        <button
          onClick={() => setCameraGridOpen(true)}
          title="Simulador de Central VMS (Grilla de Cámeras 3x3 / 4x4)"
          className="text-xs font-medium bg-[#0f274a] hover:bg-[#0F62FE] text-sky-300 hover:text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-sky-500/30 transition-all shadow-sm"
        >
          <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
          </svg>
          <span>Grilla VMS</span>
        </button>

        <button
          onClick={() => setStorageCalcOpen(true)}
          title="Calculadora de Banda y Almacenamiento"
          className="text-xs font-medium bg-[#0f274a] hover:bg-emerald-600 text-emerald-300 hover:text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-emerald-500/30 transition-all shadow-sm"
        >
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
          <span>Calculadora</span>
        </button>

        <button className="text-blue-400/60 hover:text-white transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>


        <div className="w-px h-5 bg-blue-800/50" />

        <button className="flex items-center gap-1.5 text-blue-200/70 hover:text-blue-100 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="text-[13px]">Entrar</span>
        </button>

        {/* Share button */}
        <button
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #0F62FE, #4589FF)', color: 'white', boxShadow: '0 2px 12px rgba(15,98,254,0.3)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          <span>Compartilhar</span>
        </button>

        <button className="text-blue-400/60 hover:text-blue-300 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Topbar;
