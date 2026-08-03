import { create } from 'zustand';

export type SceneObjectType = 'wall' | 'column' | 'bed' | 'sofa' | 'chair' | 'table' | 'camera' | 'person' | 'car' | 'reader' | 'controller' | 'door' | 'rack' | 'door_heavy' | 'door_sliding' | 'door_auto';

export interface SceneObject {
  id: string;
  type: SceneObjectType;
  position: [number, number, number]; // [x, height, y_2d]
  rotation: [number, number, number]; // [0, headingRad, 0] — 0=North, -PI/2=East
  scale: [number, number, number];
  color: string;
  fov?: number; // Will be computed if focalLength is present
  range?: number; // Will be computed or set manually
  focalLength?: number; // mm
  sensorWidth?: number; // mm
  resolution?: string; // MP
  model?: string;
  tilt?: number; // Vertical inclination in degrees (0 = horizontal, 90 = straight down). Cameras only.
  plate?: string; // License plate text. Cars only.
}

export interface WallSegment {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  thickness: number; // meters
  height: number;    // meters
  color: string;
}

export interface CameraDevice {
  id: string;
  name: string;
  model: string;
  resolution: '1920x1080' | '2560x1440' | '3840x2160';
  fps: 10 | 15 | 25 | 30;
  lat: number;
  lng: number;
  rotation: number;
  doriRadius: number;
  doriAngle: number;
}

export interface Scenario {
  id: string;
  name: string;
  retentionDays: number;
  zipstreamLevel: 'off' | 'recommended' | 'max';
}

interface ProjectStore {
  activeTab: string;
  setActiveTab: (tab: string) => void;

  projectName: string;
  setProjectName: (name: string) => void;

  pixelsPerMeter: number;
  setPixelsPerMeter: (ppm: number) => void;

  devices: CameraDevice[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string | null) => void;
  addDevice: (device: CameraDevice) => void;
  removeDevice: (id: string) => void;
  updateDevicePosition: (id: string, lat: number, lng: number) => void;
  updateDeviceRotation: (id: string, rotation: number) => void;
  updateDeviceProps: (id: string, patch: Partial<Pick<CameraDevice, 'rotation' | 'doriAngle' | 'doriRadius'>>) => void;

  floorPlanImage: string | null;
  setFloorPlanImage: (dataUrl: string | null) => void;

  isCatalogOpen: boolean;
  setCatalogOpen: (open: boolean) => void;

  isCameraGridOpen: boolean;
  setCameraGridOpen: (open: boolean) => void;

  isStorageCalcOpen: boolean;
  setStorageCalcOpen: (open: boolean) => void;

  scenarios: Scenario[];
  activeScenarioId: string;
  setActiveScenarioId: (id: string) => void;
  addScenario: () => void;
  removeScenario: (id: string) => void;
  updateScenario: (id: string, patch: Partial<Omit<Scenario, 'id'>>) => void;

  // Scene objects (cameras + furniture) used in 2D and 3D
  sceneObjects: SceneObject[];
  selectedSceneObjectId: string | null;
  setSelectedSceneObjectId: (id: string | null) => void;
  selectedWallId: string | null;
  setSelectedWallId: (id: string | null) => void;
  addSceneObject: (obj: SceneObject) => void;
  updateSceneObject: (id: string, patch: Partial<SceneObject>) => void;
  removeSceneObject: (id: string) => void;

  // 2D Wall segments
  walls: WallSegment[];
  addWall: (wall: WallSegment) => void;
  updateWall: (id: string, patch: Partial<WallSegment>) => void;
  removeWall: (id: string) => void;

  getTotalBandwidthMbps: () => number;
  getTotalStorageGB: () => number;
  getActiveScenario: () => Scenario;

  activeCameraViewId: string | null;
  setActiveCameraViewId: (id: string | null) => void;
}

const calcBitrateMbps = (
  resolution: CameraDevice['resolution'],
  fps: number,
  zipstream: Scenario['zipstreamLevel']
): number => {
  const base: Record<CameraDevice['resolution'], number> = {
    '1920x1080': 2.0,
    '2560x1440': 4.0,
    '3840x2160': 8.0,
  };
  let br = base[resolution] * (fps / 15);
  if (zipstream === 'recommended') br *= 0.6;
  if (zipstream === 'max') br *= 0.35;
  return br;
};

// Demo office layout – angle convention:
//   rotation[1] = 0      → North (up on canvas)
//   rotation[1] = -PI/2  → East  (right on canvas)
//   rotation[1] = PI     → South (down on canvas)
//   rotation[1] = PI/2   → West  (left on canvas)
const PI = Math.PI;

// PROJETO SALVO PARA REFERÊNCIA FUTURA
const SAVED_DEMO_WALLS: WallSegment[] = [
  { id: 'w1', x1:-10, y1:-8, x2: 10, y2:-8, thickness:0.25, height:2.8, color:'#374151' }, // North
  { id: 'w2', x1:-10, y1: 8, x2: -2, y2: 8, thickness:0.25, height:2.8, color:'#374151' }, // South L
  { id: 'w3', x1:  2, y1: 8, x2: 10, y2: 8, thickness:0.25, height:2.8, color:'#374151' }, // South R (Main door gap)
  { id: 'w4', x1:-10, y1:-8, x2:-10, y2: 8, thickness:0.25, height:2.8, color:'#374151' }, // West
  { id: 'w5', x1: 10, y1:-8, x2: 10, y2: 8, thickness:0.25, height:2.8, color:'#374151' }, // East
  // Corridor horizontal
  { id: 'w6', x1:-10, y1: 0, x2:  0, y2: 0, thickness:0.15, height:2.8, color:'#374151' }, 
  { id: 'w7', x1:  2, y1: 0, x2: 10, y2: 0, thickness:0.15, height:2.8, color:'#374151' }, // Gap in middle
  // Server room (top right)
  { id: 'w8', x1:  4, y1:-8, x2:  4, y2: -2, thickness:0.15, height:2.8, color:'#374151' }, 
  { id: 'w9', x1:  4, y1:-1, x2:  4, y2:  0, thickness:0.15, height:2.8, color:'#374151' }, // Door gap Server
  // Meeting room (bottom right)
  { id: 'w10',x1:  4, y1: 1, x2:  4, y2:  8, thickness:0.15, height:2.8, color:'#374151' },
];

const SAVED_DEMO_OBJECTS: SceneObject[] = [
  // Reception (bottom left)
  { id: 'rd', type: 'table',  position: [-6, 0, 4],   rotation: [0, 0, 0], scale: [3, 1, 1], color: '#b0c4de' },
  { id: 'rc', type: 'chair',  position: [-6, 0, 5],   rotation: [0, PI, 0], scale: [0.9, 0.9, 0.9], color: '#475569' },
  { id: 'p1', type: 'person', position: [-6, 0, 2],   rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffb6c1' },
  
  // Meeting Room (bottom right)
  { id: 'mt', type: 'table',  position: [ 7, 0, 4],   rotation: [0, 0, 0], scale: [3, 1, 1.5], color: '#854d0e' },
  { id: 'mc1',type: 'chair',  position: [ 6, 0, 3],   rotation: [0, 0, 0], scale: [0.8, 0.8, 0.8], color: '#1e293b' },
  { id: 'mc2',type: 'chair',  position: [ 8, 0, 3],   rotation: [0, 0, 0], scale: [0.8, 0.8, 0.8], color: '#1e293b' },
  { id: 'mc3',type: 'chair',  position: [ 6, 0, 5],   rotation: [0, PI, 0], scale: [0.8, 0.8, 0.8], color: '#1e293b' },
  { id: 'mc4',type: 'chair',  position: [ 8, 0, 5],   rotation: [0, PI, 0], scale: [0.8, 0.8, 0.8], color: '#1e293b' },

  // Server Room (top right)
  { id: 'sv1',type: 'column', position: [ 6, 0,-6],   rotation: [0, 0, 0], scale: [1, 2, 0.8], color: '#111827' },
  { id: 'sv2',type: 'column', position: [ 8, 0,-6],   rotation: [0, 0, 0], scale: [1, 2, 0.8], color: '#111827' },
  { id: 'sv3',type: 'column', position: [ 6, 0,-4],   rotation: [0, 0, 0], scale: [1, 2, 0.8], color: '#111827' },
  { id: 'sv4',type: 'column', position: [ 8, 0,-4],   rotation: [0, 0, 0], scale: [1, 2, 0.8], color: '#111827' },

  // Open office (top left)
  { id: 'od1', type: 'table',  position: [-6, 0,-4],   rotation: [0, 0, 0], scale: [2, 1, 1], color: '#ca8a04' },
  { id: 'oc1', type: 'chair',  position: [-6, 0,-5],   rotation: [0, PI, 0], scale: [0.8, 0.8, 0.8], color: '#64748b' },
  { id: 'od2', type: 'table',  position: [-6, 0,-2],   rotation: [0, 0, 0], scale: [2, 1, 1], color: '#ca8a04' },
  { id: 'oc2', type: 'chair',  position: [-6, 0,-3],   rotation: [0, PI, 0], scale: [0.8, 0.8, 0.8], color: '#64748b' },

  // SECURITY EQUIPMENT:
  // Main Entrance
  { id: 'cam1', type: 'camera', position: [-2, 2.8, 7.8], rotation: [0, 0, 0], scale: [1,1,1], color: '#22c55e', fov: 90, range: 8, model: 'Illustra Flex 2MP' },
  { id: 'rdr1', type: 'reader', position: [-2, 1.2, 7.8], rotation: [0, 0, 0], scale: [1,1,1], color: '#10b981' },
  { id: 'rdr2', type: 'reader', position: [ 2, 1.2, 7.8], rotation: [0, 0, 0], scale: [1,1,1], color: '#10b981' },

  // Server Room Door
  { id: 'cam2', type: 'camera', position: [ 3.8, 2.8, -1], rotation: [0, PI/2, 0], scale: [1,1,1], color: '#0ea5e9', fov: 70, range: 10, model: 'Illustra Pro 4MP' },
  { id: 'rdr3', type: 'reader', position: [ 3.8, 1.2, -1], rotation: [0, PI/2, 0], scale: [1,1,1], color: '#10b981' },
  { id: 'ctrl', type: 'controller', position: [ 9.8, 1.8, -1], rotation: [0, -PI/2, 0], scale: [1,1,1], color: '#f59e0b' },

  // Corridor Radar
  { id: 'cam3', type: 'camera', position: [-9.8, 2.8, 0], rotation: [0, -PI/2, 0], scale: [1,1,1], color: '#ef4444', fov: 120, range: 12, model: 'Illustra Radar' },
];

const DEMO_WALLS: WallSegment[] = [
  // Outer Shell
  { id: 'w_n', x1:-12, y1:-8, x2: 12, y2:-8, thickness:0.3, height:3, color:'#374151' },
  { id: 'w_s', x1:-12, y1: 8, x2: 12, y2: 8, thickness:0.3, height:3, color:'#374151' },
  { id: 'w_w', x1:-12, y1:-8, x2:-12, y2: 8, thickness:0.3, height:3, color:'#374151' },
  { id: 'w_e', x1: 12, y1:-8, x2: 12, y2: 8, thickness:0.3, height:3, color:'#374151' },

  // Reception
  { id: 'wr_1', x1:-12, y1: 2, x2: -9, y2: 2, thickness:0.15, height:2.8, color:'#475569' },
  { id: 'wr_2', x1: -7, y1: 2, x2: -4, y2: 2, thickness:0.15, height:2.8, color:'#475569' }, // Door gap at x=-8
  { id: 'wr_3', x1: -4, y1: 8, x2: -4, y2: 6.5, thickness:0.15, height:2.8, color:'#475569' }, 
  { id: 'wr_4', x1: -4, y1: 4.5, x2: -4, y2: 2, thickness:0.15, height:2.8, color:'#475569' }, // Door gap at y=5.5

  // Boardroom
  { id: 'wb_1', x1: 4, y1: 8, x2: 4, y2: 6.5, thickness:0.15, height:2.8, color:'#475569' },
  { id: 'wb_2', x1: 4, y1: 4.5, x2: 4, y2: 2, thickness:0.15, height:2.8, color:'#475569' }, // Door gap at y=5.5
  { id: 'wb_3', x1: 4, y1: 2, x2: 12, y2: 2, thickness:0.15, height:2.8, color:'#475569' },

  // Server Room
  { id: 'ws_1', x1: 6, y1:-8, x2: 6, y2: -6.5, thickness:0.2, height:3, color:'#1e293b' },
  { id: 'ws_2', x1: 6, y1:-4.5, x2: 6, y2: -2, thickness:0.2, height:3, color:'#1e293b' }, // Door gap at y=-5.5
  { id: 'ws_3', x1: 6, y1:-2, x2: 12, y2: -2, thickness:0.2, height:3, color:'#1e293b' },
];

const DEMO_OBJECTS: SceneObject[] = [
  // --- DOORS ---
  { id: 'd1', type: 'door', position: [-8, 0, 2], rotation: [0, 0, 0], scale: [1.5, 1, 1], color: '#78350f' }, // Reception Top
  { id: 'd2', type: 'door', position: [-4, 0, 5.5], rotation: [0, Math.PI/2, 0], scale: [1.5, 1, 1], color: '#78350f' }, // Reception Right
  { id: 'd3', type: 'door', position: [ 4, 0, 5.5], rotation: [0, Math.PI/2, 0], scale: [1.5, 1, 1], color: '#78350f' }, // Boardroom
  { id: 'd4', type: 'door', position: [ 6, 0,-5.5], rotation: [0, Math.PI/2, 0], scale: [1.5, 1, 1], color: '#111827' }, // Server Room

  // --- FURNITURE & PEOPLE ---
  // Reception
  { id: 'rec_t', type: 'table', position: [-8, 0, 5], rotation: [0, 0, 0], scale: [2, 1, 1.2], color: '#e2e8f0' },
  { id: 'rec_c', type: 'chair', position: [-8, 0, 6.5], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#334155' },
  { id: 'rec_p1', type: 'person', position: [-8, 0, 3], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffb6c1' },
  { id: 'rec_p2', type: 'person', position: [-10, 0, 5], rotation: [0, Math.PI/2, 0], scale: [1, 1, 1], color: '#fcd34d' },

  // Work Area
  { id: 'wa_t1', type: 'table', position: [-6, 0, -3], rotation: [0, 0, 0], scale: [3, 1, 1.5], color: '#fef3c7' },
  { id: 'wa_c1', type: 'chair', position: [-7, 0, -4], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#64748b' },
  { id: 'wa_c2', type: 'chair', position: [-5, 0, -4], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#64748b' },
  { id: 'wa_p1', type: 'person', position: [-7, 0, -2.5], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#60a5fa' },
  
  { id: 'wa_t2', type: 'table', position: [0, 0, -3], rotation: [0, 0, 0], scale: [3, 1, 1.5], color: '#fef3c7' },
  { id: 'wa_c3', type: 'chair', position: [-1, 0, -4], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#64748b' },
  { id: 'wa_c4', type: 'chair', position: [ 1, 0, -4], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#64748b' },
  { id: 'wa_p2', type: 'person', position: [ 1, 0, -2.5], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#34d399' },

  // Boardroom
  { id: 'br_t', type: 'table', position: [8, 0, 5], rotation: [0, 0, 0], scale: [4, 1, 1.5], color: '#92400e' },
  { id: 'br_c1', type: 'chair', position: [6.5, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#1e293b' },
  { id: 'br_c2', type: 'chair', position: [8, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#1e293b' },
  { id: 'br_c3', type: 'chair', position: [9.5, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#1e293b' },
  { id: 'br_c4', type: 'chair', position: [6.5, 0, 6], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#1e293b' },
  { id: 'br_p1', type: 'person', position: [9.5, 0, 6], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#fb923c' },

  // Server Room
  { id: 'sr_c1', type: 'column', position: [8, 0, -4], rotation: [0, 0, 0], scale: [1, 2, 1], color: '#0f172a' },
  { id: 'sr_c2', type: 'column', position: [10, 0, -4], rotation: [0, 0, 0], scale: [1, 2, 1], color: '#0f172a' },
  { id: 'sr_c3', type: 'column', position: [8, 0, -6], rotation: [0, 0, 0], scale: [1, 2, 1], color: '#0f172a' },
  { id: 'sr_c4', type: 'column', position: [10, 0, -6], rotation: [0, 0, 0], scale: [1, 2, 1], color: '#0f172a' },
  { id: 'sr_p1', type: 'person', position: [9, 0, -3], rotation: [0, Math.PI, 0], scale: [1, 1, 1], color: '#a78bfa' },

  // --- SECURITY DEVICES ---
  
  // Reception Access Control
  { id: 'rdr_r1', type: 'reader', position: [-4, 1.2, 6.2], rotation: [0, Math.PI/2, 0], scale: [1, 1, 1], color: '#10b981' }, // Enter Reception
  { id: 'rdr_r2', type: 'reader', position: [-4, 1.2, 4.8], rotation: [0, Math.PI/2, 0], scale: [1, 1, 1], color: '#10b981' }, // Exit Reception
  { id: 'ctr_r1', type: 'controller', position: [-3.8, 2.2, 5.5], rotation: [0, Math.PI/2, 0], scale: [1, 1, 1], color: '#f59e0b' },
  { id: 'cam_r1', type: 'camera', position: [-11.8, 2.8, 7.8], rotation: [0, -Math.PI/4, 0], scale: [1,1,1], color: '#22c55e', fov: 90, range: 10, model: 'Illustra Flex 2MP' },

  // Boardroom Access
  { id: 'rdr_b1', type: 'reader', position: [4, 1.2, 6.2], rotation: [0, Math.PI/2, 0], scale: [1, 1, 1], color: '#10b981' },
  { id: 'cam_b1', type: 'camera', position: [11.8, 2.8, 7.8], rotation: [0, Math.PI/4, 0], scale: [1,1,1], color: '#0ea5e9', fov: 60, range: 12, model: 'Illustra Pro 4MP' },

  // Server Room High Security
  { id: 'rdr_s1', type: 'reader', position: [5.8, 1.2, -4.8], rotation: [0, Math.PI/2, 0], scale: [1, 1, 1], color: '#10b981' }, // Dual factor out
  { id: 'rdr_s2', type: 'reader', position: [6.2, 1.2, -6.2], rotation: [0, Math.PI/2, 0], scale: [1, 1, 1], color: '#10b981' }, // Dual factor in
  { id: 'ctr_s1', type: 'controller', position: [6.5, 2.0, -2.2], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#f59e0b' },
  { id: 'cam_s1', type: 'camera', position: [11.8, 2.8, -7.8], rotation: [0, 3*Math.PI/4, 0], scale: [1,1,1], color: '#0ea5e9', fov: 75, range: 10, model: 'Illustra Pro 4MP' },

  // Corridor Radar
  { id: 'cam_hw', type: 'camera', position: [0, 2.8, 0], rotation: [0, Math.PI, 0], scale: [1,1,1], color: '#ef4444', fov: 180, range: 15, model: 'Illustra Radar' },
];

export const useProjectStore = create<ProjectStore>((set, get) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  projectName: 'Demo – Escritório TYCON',
  setProjectName: (name) => set({ projectName: name }),

  pixelsPerMeter: 55,
  setPixelsPerMeter: (ppm) => set({ pixelsPerMeter: ppm }),

  devices: [],
  selectedDeviceId: null,
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  addDevice: (device) => set((s) => ({ devices: [...s.devices, device] })),
  removeDevice: (id) => set((s) => ({
    devices: s.devices.filter(d => d.id !== id),
    selectedDeviceId: s.selectedDeviceId === id ? null : s.selectedDeviceId,
  })),
  updateDevicePosition: (id, lat, lng) => set((s) => ({
    devices: s.devices.map(d => d.id === id ? { ...d, lat, lng } : d),
  })),
  updateDeviceRotation: (id, rotation) => set((s) => ({
    devices: s.devices.map(d => d.id === id ? { ...d, rotation } : d),
  })),
  updateDeviceProps: (id, patch) => set((s) => ({
    devices: s.devices.map(d => d.id === id ? { ...d, ...patch } : d),
  })),

  floorPlanImage: null,
  setFloorPlanImage: (dataUrl) => set({ floorPlanImage: dataUrl }),

  isCatalogOpen: false,
  setCatalogOpen: (open) => set({ isCatalogOpen: open }),

  isCameraGridOpen: false,
  setCameraGridOpen: (open) => set({ isCameraGridOpen: open }),

  isStorageCalcOpen: false,
  setStorageCalcOpen: (open) => set({ isStorageCalcOpen: open }),

  scenarios: [{ id: 's1', name: 'Cenário Padrão', retentionDays: 30, zipstreamLevel: 'recommended' }],
  activeScenarioId: 's1',
  setActiveScenarioId: (id) => set({ activeScenarioId: id }),
  addScenario: () => set((s) => {
    const id = `s${Date.now()}`;
    return {
      scenarios: [...s.scenarios, { id, name: `Cenário ${s.scenarios.length + 1}`, retentionDays: 30, zipstreamLevel: 'recommended' }],
      activeScenarioId: id,
    };
  }),
  removeScenario: (id) => set((s) => {
    const filtered = s.scenarios.filter(sc => sc.id !== id);
    return {
      scenarios: filtered.length ? filtered : [{ id: 's_default', name: 'Cenário Padrão', retentionDays: 30, zipstreamLevel: 'recommended' }],
      activeScenarioId: filtered.length ? filtered[0].id : 's_default',
    };
  }),
  updateScenario: (id, patch) => set((s) => ({
    scenarios: s.scenarios.map(sc => sc.id === id ? { ...sc, ...patch } : sc),
  })),

  sceneObjects: DEMO_OBJECTS,
  selectedSceneObjectId: null,
  setSelectedSceneObjectId: (id) => set({ selectedSceneObjectId: id }),
  selectedWallId: null,
  setSelectedWallId: (id) => set({ selectedWallId: id }),
  addSceneObject: (obj) => set((s) => ({ sceneObjects: [...s.sceneObjects, obj], selectedSceneObjectId: obj.id })),
  updateSceneObject: (id, patch) => set((s) => ({
    sceneObjects: s.sceneObjects.map(obj => obj.id === id ? { ...obj, ...patch } : obj),
  })),
  removeSceneObject: (id) => set((s) => ({
    sceneObjects: s.sceneObjects.filter(obj => obj.id !== id),
    selectedSceneObjectId: s.selectedSceneObjectId === id ? null : s.selectedSceneObjectId,
  })),

  walls: DEMO_WALLS,
  addWall: (wall) => set((s) => ({ walls: [...s.walls, wall] })),
  updateWall: (id, patch) => set((s) => ({
    walls: s.walls.map(w => w.id === id ? { ...w, ...patch } : w),
  })),
  removeWall: (id) => set((s) => ({ walls: s.walls.filter(w => w.id !== id) })),

  getActiveScenario: () => {
    const s = get();
    return s.scenarios.find(sc => sc.id === s.activeScenarioId) || s.scenarios[0];
  },
  getTotalBandwidthMbps: () => {
    const s = get();
    const scenario = s.getActiveScenario();
    return s.devices.reduce((acc, d) => acc + calcBitrateMbps(d.resolution, d.fps, scenario.zipstreamLevel), 0);
  },
  getTotalStorageGB: () => {
    const s = get();
    const scenario = s.getActiveScenario();
    const totalBitsPerDay = s.devices.reduce((acc, d) => {
      const mbps = calcBitrateMbps(d.resolution, d.fps, scenario.zipstreamLevel);
      return acc + mbps * 1e6 * 86400;
    }, 0);
    return (totalBitsPerDay * scenario.retentionDays) / 8 / 1024 / 1024 / 1024;
  },

  activeCameraViewId: null,
  setActiveCameraViewId: (id) => set({ activeCameraViewId: id }),
}));
