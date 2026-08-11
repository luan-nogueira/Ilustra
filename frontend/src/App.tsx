import { lazy, Suspense } from 'react';
import DashboardLayout from './components/Layout/DashboardLayout';
import CanvasMap from './components/Map/CanvasMap';
import StatsBar from './components/Dashboard/StatsBar';
import ScenariosPanel from './components/Dashboard/ScenariosPanel';
import DevicesPanel from './components/Dashboard/DevicesPanel';
import CatalogModal from './components/Dashboard/CatalogModal';
import { AIConsultantChat } from './components/AI/AIConsultantChat';
import { useProjectStore } from './store/useProjectStore';

// Code-split: essas telas dependem de Three.js/jsPDF/html2canvas (pesados) e só
// são necessárias quando o usuário efetivamente abre a aba correspondente.
const FloorPlanEditor = lazy(() => import('./components/FloorPlan/FloorPlanEditor'));
const BOMReport = lazy(() => import('./components/Reports/BOMReport').then(m => ({ default: m.BOMReport })));

const TabLoading = () => (
  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando…</div>
);

const PLACEHOLDER_PAGES: Record<string, { title: string; description: string }> = {
  recording: { title: 'Ambientes', description: 'Defina os ambientes do projeto — salas, fachadas, áreas comuns — e configure as propriedades de cada espaço arquitetônico.' },
  accessories: { title: 'Materiais e Acabamentos', description: 'Catálogo de materiais: revestimentos, pisos, texturas e acabamentos associados a cada ambiente do projeto.' },
  other: { title: 'Iluminação', description: 'Planeje os pontos de luz, luminárias e cenários de iluminação artificial e natural para cada ambiente.' },
  docs: { title: 'Equipe do Projeto', description: 'Gerencie os membros da equipe, atribua funções e compartilhe o projeto com colaboradores internos e externos.' },
};

import { CameraGridModal } from './components/CameraGrid/CameraGridModal';
import { StorageCalculator } from './components/Calculator/StorageCalculator';

function App() {
  const { activeTab, isCameraGridOpen, setCameraGridOpen, isStorageCalcOpen, setStorageCalcOpen } = useProjectStore();

  const renderContent = () => {
    if (activeTab === 'overview') {
      return (
        <>
          <CanvasMap />
          <StatsBar />
          <ScenariosPanel />
        </>
      );
    }
    if (activeTab === 'devices') {
      return <DevicesPanel />;
    }
    if (activeTab === 'maps') {
      return (
        <Suspense fallback={<TabLoading />}>
          <FloorPlanEditor />
        </Suspense>
      );
    }
    if (activeTab === 'reports') {
      return (
        <Suspense fallback={<TabLoading />}>
          <BOMReport />
        </Suspense>
      );
    }
    const page = PLACEHOLDER_PAGES[activeTab];
    if (page) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
          <div className="w-16 h-16 bg-[#0F62FE]/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-[#0F62FE]/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0F62FE" strokeWidth="1.5" className="w-8 h-8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{page.title}</h2>
          <p className="text-sm text-gray-500 max-w-md leading-relaxed">{page.description}</p>
          <div className="mt-6 px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
            style={{ background: 'rgba(15,98,254,0.05)', border: '1px solid rgba(15,98,254,0.2)', color: '#0F62FE' }}>
            Módulo disponível na versão Enterprise
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <DashboardLayout>
      <CatalogModal />
      <CameraGridModal isOpen={isCameraGridOpen} onClose={() => setCameraGridOpen(false)} />
      {isStorageCalcOpen && <StorageCalculator onClose={() => setStorageCalcOpen(false)} />}
      {renderContent()}
      <AIConsultantChat />
    </DashboardLayout>
  );
}

export default App;
