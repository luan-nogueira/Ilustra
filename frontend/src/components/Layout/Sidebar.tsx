import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  divider?: boolean;
}

const Icon = ({ name }: { name: string }) => {
  const icons: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    ruler: <><line x1="5" y1="3" x2="19" y2="3"/><line x1="5" y1="21" x2="5" y2="3"/><line x1="5" y1="9" x2="9" y2="9"/><line x1="5" y1="15" x2="11" y2="15"/></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></>,
    map: <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
    filetext: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[18px] h-[18px]">
      {icons[name]}
    </svg>
  );
};

const MENU: SidebarItem[] = [
  { id: 'overview',    label: 'Visão do Projeto',   icon: <Icon name="grid"/> },
  { id: 'devices',     label: 'Elementos',           icon: <Icon name="layers"/> },
  { id: 'recording',   label: 'Ambientes',           icon: <Icon name="home"/> },
  { id: 'accessories', label: 'Materiais',           icon: <Icon name="ruler"/> },
  { id: 'other',       label: 'Iluminação',          icon: <Icon name="sun"/> },
  { id: 'maps',        label: 'Planta Baixa',        icon: <Icon name="map"/>, divider: true },
  { id: 'reports',     label: 'Relatórios / BOM',   icon: <Icon name="filetext"/> },
  { id: 'docs',        label: 'Equipe',              icon: <Icon name="users"/> },
];

const Sidebar = () => {
  const { activeTab, setActiveTab } = useProjectStore();

  return (
    <div className="w-[240px] h-full flex flex-col shrink-0 z-10"
      style={{ background: '#0B1121', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

      {/* Logo area */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0F62FE, #4589FF)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
              <polygon points="12 2 22 20 2 20"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-[15px] tracking-tight leading-none">TYCON</div>
            <div className="text-blue-300 text-[9px] font-medium tracking-widest uppercase leading-none mt-0.5">Design Studio</div>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pt-4 pb-1">
        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-blue-300/40">Projeto</span>
      </div>

      <nav className="flex-1 py-1 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {MENU.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                {item.divider && <li className="my-3 mx-2 border-t border-white/10" />}
                <li className="relative">
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#0F62FE] rounded-r-full" />
                  )}
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-lg transition-all ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-blue-200/70 hover:bg-white/8 hover:text-blue-100'
                    }`}
                    style={isActive ? { background: 'rgba(15,98,254,0.15)', border: '1px solid rgba(15,98,254,0.2)' } : { border: '1px solid transparent' }}
                  >
                    <span className={isActive ? 'text-[#4589FF]' : 'text-blue-300/60'}>{item.icon}</span>
                    <span className={`text-[13px] ${isActive ? 'font-semibold text-white' : 'font-normal'}`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </nav>

      {/* Bottom user area */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #0F62FE, #4589FF)' }}>
            LN
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">Luan Nogueira</div>
            <div className="text-blue-300/60 text-[10px] truncate">TYCON Design Studio</div>
          </div>
          <button className="text-blue-300/40 hover:text-blue-200 transition-colors">
            <Icon name="settings" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
