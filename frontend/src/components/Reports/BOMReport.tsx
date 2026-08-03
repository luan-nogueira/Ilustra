import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

interface BOMItem {
  id: string;
  category: 'CCTV' | 'Controle de Acesso' | 'Infraestrutura & Mobiliário' | 'Rede & Armazenamento';
  code: string;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceUSD: number;
}

export const BOMReport: React.FC = () => {
  const { sceneObjects, projectName, getActiveScenario, getTotalStorageGB } = useProjectStore();
  const [currency, setCurrency] = useState<'BRL' | 'USD' | 'EUR'>('USD');
  const [exchangeRate] = useState<number>(5.5);

  // Extract items from store
  const items: BOMItem[] = [];

  // 1. CCTV Cameras from sceneObjects
  const cameraObjs = sceneObjects.filter(o => o.type === 'camera');
  const camModelsMap: Record<string, { count: number; res?: string; fov?: number }> = {};
  
  cameraObjs.forEach(cam => {
    const model = cam.model || 'Illustra Flex 2MP';
    if (!camModelsMap[model]) {
      camModelsMap[model] = { count: 0, res: cam.resolution || '2MP', fov: cam.fov || 90 };
    }
    camModelsMap[model].count += 1;
  });

  Object.entries(camModelsMap).forEach(([model, info], idx) => {
    let price = 450;
    if (model.includes('4MP')) price = 750;
    if (model.includes('8MP') || model.includes('4K')) price = 1200;
    if (model.includes('Radar')) price = 2800;
    if (model.toUpperCase().includes('LPR')) price = 1650;

    items.push({
      id: `cam-${idx}`,
      category: 'CCTV',
      code: `CAM-${100 + idx}`,
      name: `Câmera IP ${model}`,
      description: `Câmera de Segurança HD/4K IP com visão noturna IR, fov ${info.fov}°`,
      unit: 'Unid',
      quantity: info.count,
      unitPriceUSD: price,
    });
  });

  // 2. Access Control (Readers, Controllers, Doors)
  const readers = sceneObjects.filter(o => o.type === 'reader');
  if (readers.length > 0) {
    items.push({
      id: 'rdr-1',
      category: 'Controle de Acesso',
      code: 'ACC-RDR-01',
      name: 'Leitor de Cartão / Biometria IP',
      description: 'Leitora de acesso RFID 13.56MHz Mifare / Suporte a QR Code & Biometria',
      unit: 'Unid',
      quantity: readers.length,
      unitPriceUSD: 220,
    });
  }

  const controllers = sceneObjects.filter(o => o.type === 'controller');
  if (controllers.length > 0) {
    items.push({
      id: 'ctr-1',
      category: 'Controle de Acesso',
      code: 'ACC-CTR-04',
      name: 'Controladora de Acesso Multi-Portas',
      description: 'Painel IP de controle para até 4 portas com backup de bateria',
      unit: 'Unid',
      quantity: Math.max(1, Math.ceil(controllers.length)),
      unitPriceUSD: 890,
    });
  }

  const doors = sceneObjects.filter(o => o.type === 'door');
  const doorsHeavy = sceneObjects.filter(o => o.type === 'door_heavy');
  const doorsSliding = sceneObjects.filter(o => o.type === 'door_sliding');
  const doorsAuto = sceneObjects.filter(o => o.type === 'door_auto');
  const allDoors = [...doors, ...doorsHeavy, ...doorsSliding, ...doorsAuto];

  if (doors.length > 0) {
    items.push({
      id: 'lock-1',
      category: 'Controle de Acesso',
      code: 'ACC-LCK-180',
      name: 'Fechadura Eletroímã 180kgf + Botoeira No-Touch',
      description: 'Kit de fechadura eletromagnética padrão para portas internas',
      unit: 'Conjunto',
      quantity: doors.length,
      unitPriceUSD: 180,
    });
  }
  if (doorsHeavy.length > 0) {
    items.push({
      id: 'lock-2',
      category: 'Controle de Acesso',
      code: 'ACC-LCK-600',
      name: 'Fechadura Eletroímã 600kgf de Alta Segurança',
      description: 'Kit de fechadura eletromagnética reforçada para portas corta-fogo / blindadas',
      unit: 'Conjunto',
      quantity: doorsHeavy.length,
      unitPriceUSD: 340,
    });
  }
  if (doorsSliding.length > 0) {
    items.push({
      id: 'lock-3',
      category: 'Controle de Acesso',
      code: 'ACC-MTR-SLD',
      name: 'Kit Motor para Porta Corrediça + Controladora',
      description: 'Motorização e trava eletrônica para portas corrediças de acesso controlado',
      unit: 'Conjunto',
      quantity: doorsSliding.length,
      unitPriceUSD: 780,
    });
  }
  if (doorsAuto.length > 0) {
    items.push({
      id: 'lock-4',
      category: 'Controle de Acesso',
      code: 'ACC-MTR-AUTO',
      name: 'Operador de Porta Automática + Sensor de Presença',
      description: 'Kit de automação com sensor de presença e liberação via controladora de acesso',
      unit: 'Conjunto',
      quantity: doorsAuto.length,
      unitPriceUSD: 1450,
    });
  }

  // 3. Infrastructure & Furniture (Server Racks, Heavy/Sliding/Auto Doors)
  const racks = sceneObjects.filter(o => o.type === 'rack');
  if (racks.length > 0) {
    items.push({
      id: 'infra-rack',
      category: 'Infraestrutura & Mobiliário',
      code: 'INF-RACK-42U',
      name: 'Rack Fechado 19" 42U para Servidores/NVR',
      description: 'Rack de piso padrão 19 polegadas com organizadores de cabos e réguas PDU',
      unit: 'Unid',
      quantity: racks.length,
      unitPriceUSD: 950,
    });
  }
  if (doors.length > 0) {
    items.push({
      id: 'infra-door',
      category: 'Infraestrutura & Mobiliário',
      code: 'INF-DR-SIMPLE',
      name: 'Porta Simples com Batente',
      description: 'Folha de porta padrão com batente e tubulação embutida para cabeamento',
      unit: 'Unid',
      quantity: doors.length,
      unitPriceUSD: 320,
    });
  }
  if (doorsHeavy.length > 0) {
    items.push({
      id: 'infra-door-heavy',
      category: 'Infraestrutura & Mobiliário',
      code: 'INF-DR-HVY',
      name: 'Porta Pesada Corta-Fogo com Batente Metálico',
      description: 'Porta reforçada com núcleo metálico, batente de aço e tubulação embutida para cabeamento',
      unit: 'Unid',
      quantity: doorsHeavy.length,
      unitPriceUSD: 1200,
    });
  }
  if (doorsSliding.length > 0) {
    items.push({
      id: 'infra-door-sliding',
      category: 'Infraestrutura & Mobiliário',
      code: 'INF-DR-SLD',
      name: 'Conjunto de Porta Corrediça com Trilho Superior',
      description: 'Folha corrediça sobre trilho aéreo, indicada para áreas de grande fluxo',
      unit: 'Unid',
      quantity: doorsSliding.length,
      unitPriceUSD: 890,
    });
  }
  if (doorsAuto.length > 0) {
    items.push({
      id: 'infra-door-auto',
      category: 'Infraestrutura & Mobiliário',
      code: 'INF-DR-AUTO',
      name: 'Porta Automatizada de Acesso',
      description: 'Folha de porta com operador automático integrado e sensores de segurança',
      unit: 'Unid',
      quantity: doorsAuto.length,
      unitPriceUSD: 1600,
    });
  }

  // 4. Network & Storage
  const totalCams = cameraObjs.length;
  if (totalCams > 0) {
    const switchesNeeded = Math.ceil(totalCams / 16);
    items.push({
      id: 'net-sw',
      category: 'Rede & Armazenamento',
      code: 'NET-SW-16POE',
      name: 'Switch Gerenciável 16 Portas Gigabit PoE+ (250W)',
      description: 'Switch de rede gerenciável Layer 2/3 para tráfego contínuo de CFTV',
      unit: 'Unid',
      quantity: switchesNeeded,
      unitPriceUSD: 480,
    });

    const storageTB = Math.ceil(getTotalStorageGB() / 1000) || 12;
    const hddCount = Math.max(2, Math.ceil(storageTB / 8));
    items.push({
      id: 'net-storage',
      category: 'Rede & Armazenamento',
      code: `HDD-WD-8TB`,
      name: 'Disco Rígido HD Surveillance 8TB (Enterprise)',
      description: `HD específico para gravação 24/7 de vídeo (Capacidade total est.: ${storageTB} TB)`,
      unit: 'Unid',
      quantity: hddCount,
      unitPriceUSD: 240,
    });

    items.push({
      id: 'net-cable',
      category: 'Rede & Armazenamento',
      code: 'INF-CAB-CAT6',
      name: 'Caixa de Cabo UTP Cat6 100% Cobre (305m)',
      description: 'Cabo de rede trançado para pontos de câmeras e leitoras de acesso',
      unit: 'Caixa',
      quantity: Math.max(1, Math.ceil(totalCams * 45 / 305)),
      unitPriceUSD: 160,
    });
  }

  const formatPrice = (priceUSD: number) => {
    let mult = 1;
    let symbol = '$';
    if (currency === 'BRL') { mult = exchangeRate; symbol = 'R$'; }
    if (currency === 'EUR') { mult = 0.92; symbol = '€'; }
    return `${symbol} ${(priceUSD * mult).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalUSD = items.reduce((acc, item) => acc + item.unitPriceUSD * item.quantity, 0);

  const exportToCSV = () => {
    const headers = ['Categoria', 'Código', 'Item', 'Descrição', 'Unidade', 'Quantidade', 'Preço Unitário (USD)', 'Total (USD)'];
    const rows = items.map(i => [
      `"${i.category}"`,
      `"${i.code}"`,
      `"${i.name}"`,
      `"${i.description}"`,
      `"${i.unit}"`,
      i.quantity,
      i.unitPriceUSD,
      i.quantity * i.unitPriceUSD
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BOM_${projectName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      {/* Header */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0F62FE] uppercase tracking-wider mb-1">
              <span>Documentação Técnica</span>
              <span>•</span>
              <span>Lista de Materiais</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{projectName} — BOM (Bill of Materials)</h1>
            <p className="text-sm text-gray-500 mt-1">
              Quantitativo consolidado de câmeras CCTV, leitoras de acesso, infraestrutura e rede.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as any)}
              className="bg-gray-100 border border-gray-300 text-gray-700 text-sm rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0F62FE]"
            >
              <option value="USD">Dólar ($ USD)</option>
              <option value="BRL">Real (R$ BRL)</option>
              <option value="EUR">Euro (€ EUR)</option>
            </select>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
            <span className="text-xs text-gray-500 font-medium">Total de Câmeras IP</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{totalCams} Unid</div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">CFTV de Alta Definição</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
            <span className="text-xs text-gray-500 font-medium">Pontos de Controle de Acesso</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{readers.length} Leitoras</div>
            <div className="text-xs text-blue-600 mt-1 font-medium">{allDoors.length} Portas Controladas</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
            <span className="text-xs text-gray-500 font-medium">Armazenamento Estimado</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{(getTotalStorageGB() / 1000).toFixed(1)} TB</div>
            <div className="text-xs text-amber-600 mt-1 font-medium">{getActiveScenario().retentionDays} dias de retenção</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-200 bg-gradient-to-br from-white to-blue-50/40">
            <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Investimento Estimado</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{formatPrice(totalUSD)}</div>
            <div className="text-xs text-gray-500 mt-1">Valores com base nos itens cadastrados</div>
          </div>
        </div>

        {/* BOM Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Detalhamento dos Componentes</h3>
            <span className="text-xs text-gray-500">{items.length} categorias/itens listados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-100/70 text-xs uppercase font-semibold text-gray-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Categoria</th>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-6">Item / Equipamento</th>
                  <th className="py-3.5 px-4 text-center">Qtd</th>
                  <th className="py-3.5 px-6 text-right">Preço Un.</th>
                  <th className="py-3.5 px-6 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      Nenhum equipamento adicionado ao projeto ainda.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const subtotal = item.unitPriceUSD * item.quantity;
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-4 px-6 font-medium text-gray-900">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.category === 'CCTV' ? 'bg-emerald-100 text-emerald-800' :
                            item.category === 'Controle de Acesso' ? 'bg-blue-100 text-blue-800' :
                            item.category === 'Infraestrutura & Mobiliário' ? 'bg-purple-100 text-purple-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-gray-500">{item.code}</td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-gray-800">{item.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-gray-900">{item.quantity} {item.unit}</td>
                        <td className="py-4 px-6 text-right font-medium text-gray-600">{formatPrice(item.unitPriceUSD)}</td>
                        <td className="py-4 px-6 text-right font-bold text-gray-900">{formatPrice(subtotal)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={5} className="py-4 px-6 text-right text-gray-700 text-base">Custo Total Estimado:</td>
                    <td className="py-4 px-6 text-right text-blue-700 text-lg">{formatPrice(totalUSD)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
