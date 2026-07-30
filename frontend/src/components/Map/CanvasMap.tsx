import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useProjectStore } from '../../store/useProjectStore';
import CameraPropertiesPanel from './CameraPropertiesPanel';

// ─── Geocoding types ─────────────────────────────────────────────────────────
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// ─── Map flyTo controller ────────────────────────────────────────────────────
const FlyToController = ({ target }: { target: { lat: number; lng: number; key: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 18, { duration: 1.4 });
  }, [target, map]);
  return null;
};

// ─── Camera cone helper ──────────────────────────────────────────────────────
const getConePolygon = (lat: number, lng: number, radiusM: number, rotationDeg: number, angleDeg: number): [number, number][] => {
  const R = 6378137;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const latR = toRad(lat), lngR = toRad(lng), d = radiusM / R, half = angleDeg / 2;
  const pts: [number, number][] = [[lat, lng]];
  for (let i = 0; i <= 24; i++) {
    const bearing = toRad((rotationDeg - half) + (angleDeg * i) / 24);
    const pLat = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(bearing));
    const pLng = lngR + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(latR), Math.cos(d) - Math.sin(latR) * Math.sin(pLat));
    pts.push([toDeg(pLat), toDeg(pLng)]);
  }
  pts.push([lat, lng]);
  return pts;
};

const makeCameraIcon = (selected: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${selected ? '#0091da' : '#fff'};border:2.5px solid ${selected ? '#005f91' : '#555'};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;transition:all 0.15s;">
      <div style="width:8px;height:8px;background:${selected ? '#fff' : '#333'};border-radius:50%;"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const MapClickHandler = () => {
  const { setSelectedDeviceId } = useProjectStore();
  useMapEvents({ click: () => setSelectedDeviceId(null) });
  return null;
};

// ─── Zoom controller via useMap ──────────────────────────────────────────────
const ZoomController = ({ action }: { action: 'in' | 'out' | null }) => {
  const map = useMap();
  useEffect(() => {
    if (action === 'in') map.zoomIn();
    if (action === 'out') map.zoomOut();
  }, [action, map]);
  return null;
};

// ─── Location Search Bar ─────────────────────────────────────────────────────
const LocationSearch = ({ onSelect }: { onSelect: (lat: number, lng: number, name: string) => void }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1&accept-language=pt-BR,pt`;
      const res = await fetch(url);
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch { setResults([]); setOpen(false); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (r: NominatimResult) => {
    setQuery(r.display_name.split(',').slice(0, 2).join(',').trim());
    setResults([]); setOpen(false);
    onSelect(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} style={{ width: 300, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 38,
        background: 'rgba(255,255,255,0.97)', border: `1.5px solid ${open ? '#0091da' : 'rgba(0,0,0,0.15)'}`,
        borderRadius: 10, boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
        {loading ? (
          <svg style={{ width: 15, height: 15, flexShrink: 0, animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="#0091da" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.15"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#0091da"/>
          </svg>
        ) : (
          <svg style={{ width: 15, height: 15, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke={open ? '#0091da' : '#888'} strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        )}
        <input type="text" value={query} onChange={handleChange} onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Pesquisar endereço ou local..."
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#1a1a2e', fontFamily: 'Inter, sans-serif' }} />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            style={{ color: '#aaa', cursor: 'pointer', display: 'flex', padding: 2 }}>
            <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: 'white', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)', border: '1px solid rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 9999 }}>
          {results.map((r, i) => (
            <button key={r.place_id} onClick={() => handleSelect(r)}
              style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', textAlign: 'left',
                background: 'transparent', border: 'none', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg style={{ width: 13, height: 13, marginTop: 2, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="#0091da" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.display_name.split(',').slice(0, 2).join(',')}
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.display_name.split(',').slice(2, 5).join(',').trim()}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ─── Botão de controle (zoom / rotação) ──────────────────────────────────────
const CtrlBtn = ({
  onClick, children, title, active,
}: { onClick: () => void; children: React.ReactNode; title?: string; active?: boolean }) => (
  <button onClick={onClick} title={title}
    style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? '#0091da' : 'rgba(255,255,255,0.97)',
      color: active ? 'white' : '#1a1a2e',
      border: '1px solid rgba(0,0,0,0.12)',
      cursor: 'pointer', borderRadius: 8,
      fontSize: 16, fontWeight: 700, fontFamily: 'Inter, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.15s',
    }}
    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = '#f0f7ff'; } }}
    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.97)'; } }}
  >
    {children}
  </button>
);

// ─── Main CanvasMap ──────────────────────────────────────────────────────────
const CanvasMap = () => {
  const { devices, selectedDeviceId, setSelectedDeviceId, setCatalogOpen, updateDevicePosition } = useProjectStore();

  const defaultCenter: [number, number] = [-23.5505, -46.6333];
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [locationBadge, setLocationBadge] = useState('');
  const [mapRotation, setMapRotation] = useState(0);          // graus
  const [zoomAction, setZoomAction] = useState<'in' | 'out' | null>(null);
  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null;

  const handleLocationSelect = (lat: number, lng: number, name: string) => {
    setFlyTarget({ lat, lng, key: Date.now() });
    setLocationBadge(name.split(',').slice(0, 3).join(',').trim());
  };

  const rotate = (delta: number) => setMapRotation(r => {
    const next = (r + delta + 360) % 360;
    return next;
  });
  const resetRotation = () => setMapRotation(0);

  // Dispara zoom e reseta action para poder reusar
  const triggerZoom = (dir: 'in' | 'out') => {
    setZoomAction(dir);
    setTimeout(() => setZoomAction(null), 100);
  };

  return (
    <div className="relative flex-1 min-h-0" style={{ overflow: 'hidden' }}>

      {/* ── Camada de UI (não rotaciona) ── */}

      {/* Barra de busca + adicionar */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
        <LocationSearch onSelect={handleLocationSelect} />
        <button onClick={() => setCatalogOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px',
            background: 'rgba(255,255,255,0.97)', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 10,
            boxShadow: '0 2px 16px rgba(0,0,0,0.25)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            color: '#1a1a2e', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.97)')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#0091da" strokeWidth="2.5" style={{ width: 15, height: 15 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Adicionar elemento
        </button>
      </div>

      {/* Controles de Zoom + Rotação — canto inferior direito */}
      <div style={{ position: 'absolute', bottom: 32, right: 12, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Zoom */}
        <CtrlBtn onClick={() => triggerZoom('in')} title="Mais zoom">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </CtrlBtn>
        <CtrlBtn onClick={() => triggerZoom('out')} title="Menos zoom">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </CtrlBtn>

        {/* Separador */}
        <div style={{ height: 6 }} />

        {/* Rotação */}
        <CtrlBtn onClick={() => rotate(-15)} title="Girar -15°">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}>
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-6"/>
          </svg>
        </CtrlBtn>

        {/* Bússola / reset */}
        <CtrlBtn onClick={resetRotation} title="Resetar rotação (Norte)" active={mapRotation !== 0}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, gap: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: mapRotation !== 0 ? '#fff' : '#e02020' }}>N</span>
            <span style={{ fontSize: 7, color: mapRotation !== 0 ? 'rgba(255,255,255,0.6)' : '#aaa' }}>
              {mapRotation !== 0 ? `${mapRotation}°` : '↑'}
            </span>
          </div>
        </CtrlBtn>

        <CtrlBtn onClick={() => rotate(15)} title="Girar +15°">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-.49-6"/>
          </svg>
        </CtrlBtn>
      </div>

      {/* Badge de localização */}
      {locationBadge && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 400,
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          background: 'rgba(7,24,48,0.9)', border: '1px solid rgba(0,145,218,0.4)', borderRadius: 999,
          color: '#a8d4f0', fontSize: 12, fontFamily: 'Inter, sans-serif',
          backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          maxWidth: '50%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
          <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="#00c6ff" strokeWidth="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {locationBadge}
        </div>
      )}

      {/* Painel de câmera */}
      {selectedDevice && <CameraPropertiesPanel device={selectedDevice} />}

      {/* ── Mapa rotacionado ── */}
      <div style={{
        width: '100%', height: '100%',
        transform: `rotate(${mapRotation}deg)`,
        transformOrigin: 'center center',
        transition: 'transform 0.3s ease',
        /* Expandimos levemente para não aparecerem cantos brancos na rotação */
        scale: mapRotation % 90 !== 0 ? '1.15' : '1',
      }}>
        <MapContainer
          center={defaultCenter}
          zoom={17}
          minZoom={3}
          maxZoom={19}
          scrollWheelZoom={true}
          wheelPxPerZoomLevel={120}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
            maxNativeZoom={19}
            maxZoom={19}
          />
          <MapClickHandler />
          <FlyToController target={flyTarget} />
          <ZoomController action={zoomAction} />

          {devices.map((cam) => {
            const selected = cam.id === selectedDeviceId;
            return (
              <React.Fragment key={cam.id}>
                <Polygon
                  positions={getConePolygon(cam.lat, cam.lng, cam.doriRadius, cam.rotation, cam.doriAngle)}
                  pathOptions={{ fillColor: selected ? '#0091da' : '#ffcc00', fillOpacity: selected ? 0.35 : 0.22, color: selected ? '#0068a0' : '#c8a800', weight: selected ? 2 : 1 }}
                />
                <Marker position={[cam.lat, cam.lng]} icon={makeCameraIcon(selected)} draggable
                  eventHandlers={{
                    click: (e) => { e.originalEvent.stopPropagation(); setSelectedDeviceId(cam.id); },
                    dragend: (e) => { const { lat, lng } = e.target.getLatLng(); updateDevicePosition(cam.id, lat, lng); },
                  }}
                />
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Empty state */}
      {devices.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[300]">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-4 shadow-lg text-center">
            <p className="text-gray-600 text-sm">
              Pesquise um endereço ou clique em <strong>Adicionar elemento</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasMap;
