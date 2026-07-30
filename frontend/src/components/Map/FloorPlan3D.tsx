import React, { Suspense, useMemo, useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, WallSegment, SceneObject } from '../../store/useProjectStore';

// ── Furniture dimensions [w, h, d] in meters ─────────────────────────────────
const FURN_DIMS: Record<string, [number, number, number]> = {
  chair:  [0.6,  0.85, 0.6],
  table:  [1.4,  0.75, 0.7],
  sofa:   [2.0,  0.85, 0.9],
  bed:    [1.6,  0.5,  2.0],
  column: [0.5,  2.8,  0.5],
  person: [0.5,  1.75, 0.5],
  reader: [0.2,  0.25, 0.05],
  controller: [0.5, 0.6, 0.15],
  door: [0.9, 2.1, 0.1],
};

// ── Ray casting – Visibility Polygon ────────────────────────────────────────

function rayHitWalls(
  ox: number, oy: number, dx: number, dy: number,
  walls: WallSegment[], maxT: number,
): number {
  let closest = maxT;
  for (const w of walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (len < 0.001) continue;
    
    // Extend the wall segment slightly by its thickness/2 to perfectly close corner gaps
    const ext = (w.thickness ?? 0.2) / 2;
    const nx = (w.x2 - w.x1) / len;
    const ny = (w.y2 - w.y1) / len;
    const ex1 = w.x1 - nx * ext;
    const ey1 = w.y1 - ny * ext;
    const ex2 = w.x2 + nx * ext;
    const ey2 = w.y2 + ny * ext;

    const ex = ex2 - ex1, ey = ey2 - ey1;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;
    
    const t2 = ((ex1 - ox) * dy - (ey1 - oy) * dx) / denom;
    if (t2 < -0.001 || t2 > 1.001) continue;
    
    const t1 = ((ex1 - ox) * ey - (ey1 - oy) * ex) / denom;
    if (t1 > 0.001 && t1 < closest) closest = t1;
  }
  return closest;
}

function computeVisibilityPoly(
  camX: number, camZ: number,
  centerAngle: number,
  halfFovRad: number,
  maxRange: number,
  walls: WallSegment[],
  numRays = 80,
): [number, number][] {
  let ox = camX, oz = camZ;
  const cdx = Math.cos(centerAngle), cdz = Math.sin(centerAngle);

  // Iteratively push the raycast origin firmly into the room, away from all nearby walls
  for (let pass = 0; pass < 3; pass++) {
    for (const w of walls) {
      const l2 = (w.x2 - w.x1)**2 + (w.y2 - w.y1)**2;
      if (l2 < 0.001) continue;
      let t = ((ox - w.x1) * (w.x2 - w.x1) + (oz - w.y1) * (w.y2 - w.y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = w.x1 + t * (w.x2 - w.x1);
      const pz = w.y1 + t * (w.y2 - w.y1);
      
      if (Math.hypot(ox - px, oz - pz) < 0.5) {
        let nx = -(w.y2 - w.y1) / Math.sqrt(l2);
        let nz = (w.x2 - w.x1) / Math.sqrt(l2);
        if (nx * cdx + nz * cdz < 0) { nx = -nx; nz = -nz; }
        
        if (nx * cdx + nz * cdz > 0.01) {
          const ext = (w.thickness ?? 0.2) / 2 + 0.05;
          const dot = (ox - px) * nx + (oz - pz) * nz;
          if (dot < ext) {
            const push = ext - dot;
            ox += nx * push;
            oz += nz * push;
          }
        }
      }
    }
  }

  const pts: [number, number][] = [[ox, oz]];
  for (let i = 0; i <= numRays; i++) {
    const angle = centerAngle - halfFovRad + (i / numRays) * 2 * halfFovRad;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const t = rayHitWalls(ox, oz, dx, dz, walls, maxRange);
    pts.push([ox + dx * t, oz + dz * t]);
  }
  return pts;
}

interface FloorPlan3DProps {
  tool?: string;
  onFloorClick?: (x: number, z: number) => void;
  onObjectClick?: (type: 'wall'|'obj', id: string) => void;
}

// ── Wall ─────────────────────────────────────────────────────────────────────
const Wall3D: React.FC<{ wall: WallSegment } & FloorPlan3DProps> = ({ wall, tool, onObjectClick }) => {
  const { selectedWallId, setSelectedWallId, setSelectedSceneObjectId } = useProjectStore();
  const selected = selectedWallId === wall.id;
  
  const dx = wall.x2 - wall.x1;
  const dz = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dz);
  const rotY = -Math.atan2(dz, dx);
  const cx = (wall.x1 + wall.x2) / 2;
  const cz = (wall.y1 + wall.y2) / 2;

  return (
    <mesh
      position={[cx, wall.height / 2, cz]}
      rotation={[0, rotY, 0]}
      castShadow receiveShadow
      onClick={(e) => { 
        e.stopPropagation(); 
        if (onObjectClick) onObjectClick('wall', wall.id);
        else { setSelectedWallId(wall.id); setSelectedSceneObjectId(null); }
      }}
      onPointerOver={(e) => { 
        e.stopPropagation(); 
        document.body.style.cursor = tool === 'erase' ? 'crosshair' : 'pointer'; 
      }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <boxGeometry args={[length + wall.thickness, wall.height, wall.thickness]} />
      <meshStandardMaterial 
        color={wall.color || "#f8fafc"} 
        roughness={0.88} 
        metalness={0} 
        emissive={selected ? "#2563eb" : "#000"} 
        emissiveIntensity={selected ? 0.15 : 0} 
      />
    </mesh>
  );
};

const WallBase: React.FC<{ wall: WallSegment }> = ({ wall }) => {
  const dx = wall.x2 - wall.x1, dz = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dz);
  const rotY = -Math.atan2(dz, dx);
  return (
    <mesh position={[(wall.x1+wall.x2)/2, 0.06, (wall.y1+wall.y2)/2]} rotation={[0, rotY, 0]}>
      <boxGeometry args={[length + wall.thickness, 0.12, wall.thickness + 0.04]} />
      <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
    </mesh>
  );
};

// ── Furniture ─────────────────────────────────────────────────────────────────
const Furniture3D: React.FC<{ obj: SceneObject } & FloorPlan3DProps> = ({ obj, tool, onObjectClick }) => {
  const { selectedSceneObjectId, setSelectedSceneObjectId, setSelectedWallId, updateSceneObject } = useProjectStore();
  const selected = selectedSceneObjectId === obj.id;
  const groupRef = React.useRef<THREE.Group>(null);
  
  const [w, h, d] = FURN_DIMS[obj.type] ?? [1, 0.5, 1];
  const sw = obj.scale[0], sd = obj.scale[2];

  // --- Custom Drag Logic ---
  const [isDragging, setIsDragging] = React.useState(false);
  const dragOffset = React.useRef(new THREE.Vector3());
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const controls = useThree((state: any) => state.controls);

  React.useEffect(() => {
    const handleUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (controls) controls.enabled = true;
      }
    };
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [isDragging, controls]);

  const interact = {
    onPointerDown: (e: any) => { 
      e.stopPropagation(); 
      if (tool === 'select') {
        const target = new THREE.Vector3();
        e.ray.intersectPlane(floorPlane, target);
        dragOffset.current.set(obj.position[0] - target.x, 0, obj.position[2] - target.z);
        setIsDragging(true);
        try { e.target.setPointerCapture(e.pointerId); } catch(err){}
        if (controls) controls.enabled = false;
      }
      if (onObjectClick) onObjectClick('obj', obj.id);
      else { setSelectedSceneObjectId(obj.id); setSelectedWallId(null); }
    },
    onPointerMove: (e: any) => {
      if (isDragging && tool === 'select') {
        e.stopPropagation();
        const target = new THREE.Vector3();
        if (e.ray.intersectPlane(floorPlane, target)) {
          updateSceneObject(obj.id, { 
            position: [target.x + dragOffset.current.x, obj.position[1], target.z + dragOffset.current.z] 
          });
        }
      }
    },
    onPointerUp: (e: any) => {
      if (isDragging) {
        setIsDragging(false);
        try { e.target.releasePointerCapture(e.pointerId); } catch(err){}
        if (controls) controls.enabled = true;
      }
    },
    onPointerOver: (e: any) => { 
      e.stopPropagation(); 
      document.body.style.cursor = tool === 'erase' ? 'crosshair' : tool === 'select' ? 'move' : 'pointer'; 
    },
    onPointerOut: (e: any) => { 
      if (!isDragging) document.body.style.cursor = 'auto'; 
    }
  };

  if (obj.type === 'column') {
    return (
      <mesh ref={groupRef as any} position={[obj.position[0], h / 2, obj.position[2]]} castShadow receiveShadow {...interact}>
        <cylinderGeometry args={[0.28, 0.28, h, 16]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.6} metalness={0.05} emissive={selected ? "#2563eb" : "#000"} emissiveIntensity={selected ? 0.2 : 0} />
      </mesh>
    );
  }
  if (obj.type === 'person') {
    const hScale = obj.scale?.[1] ?? 1.0;
    const pH = hScale * 1.75;
    const skin = obj.color ?? '#4fb8f7';
    const emissive = selected ? '#2563eb' : '#000';
    const ei = selected ? 0.25 : 0;
    const mat = <meshStandardMaterial color={skin} roughness={0.4} metalness={0.05} emissive={emissive} emissiveIntensity={ei} />;

    // proportions relative to total height
    const headR  = pH * 0.12;
    const torsoH = pH * 0.30;
    const torsoR = pH * 0.08;
    const limbR  = pH * 0.04;
    const armH   = pH * 0.30;
    const legH   = pH * 0.38;

    // key Y positions (from center of torso = 0)
    const headY    = torsoH / 2 + headR * 1.1;
    const armTopY  = torsoH * 0.35;           // shoulder level
    const armBotY  = armTopY - armH;          // arm hangs straight down
    const armMidY  = (armTopY + armBotY) / 2;
    const hipY     = -(torsoH / 2);
    const legMidY  = hipY - legH / 2;
    const armSideX = torsoR + limbR * 1.1;    // just outside the torso

    return (
      <group ref={groupRef} position={[obj.position[0], pH / 2, obj.position[2]]} rotation={[0, obj.rotation[1], 0]} {...interact}>

        {/* Head */}
        <mesh position={[0, headY, 0]} castShadow receiveShadow>
          <sphereGeometry args={[headR, 16, 16]} />{mat}
        </mesh>

        {/* Torso */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[torsoR, torsoH, 8, 16]} />{mat}
        </mesh>

        {/* Left Arm – straight down */}
        <mesh position={[-armSideX, armMidY, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[limbR, armH, 6, 12]} />{mat}
        </mesh>

        {/* Right Arm – straight down */}
        <mesh position={[armSideX, armMidY, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[limbR, armH, 6, 12]} />{mat}
        </mesh>

        {/* Left Leg – straight down */}
        <mesh position={[-torsoR * 0.5, legMidY, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[limbR * 1.05, legH, 6, 12]} />{mat}
        </mesh>

        {/* Right Leg – straight down */}
        <mesh position={[torsoR * 0.5, legMidY, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[limbR * 1.05, legH, 6, 12]} />{mat}
        </mesh>

      </group>
    );
  }


  return (
      <group ref={groupRef} position={[obj.position[0], 0, obj.position[2]]} rotation={[0, obj.rotation[1], 0]} {...interact}>
        <mesh position={[0, h / 2, 0]} scale={[sw, 1, sd]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={obj.color} roughness={0.72} metalness={0.08} emissive={selected ? "#2563eb" : "#000"} emissiveIntensity={selected ? 0.2 : 0} />
        </mesh>
        {obj.type === 'table' && (
          <mesh position={[0, h + 0.01, 0]} scale={[sw, 1, sd]}>
            <boxGeometry args={[w - 0.04, 0.025, d - 0.04]} />
            <meshStandardMaterial color="#fff" roughness={0.5} metalness={0.1} emissive={selected ? "#2563eb" : "#000"} emissiveIntensity={selected ? 0.1 : 0} />
          </mesh>
        )}
        {obj.type === 'chair' &&
          [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]].map(([lx,lz], i) => (
            <mesh key={i} position={[lx*sw, 0.2, lz*sd]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.42, 6]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          ))
        }
      </group>
  );
};

// ── Camera ─────────────────────────────────────────────────────────────────────
const Camera3D: React.FC<{ obj: SceneObject; walls: WallSegment[] } & FloorPlan3DProps> = ({ obj, walls, tool, onObjectClick }) => {
  const { selectedSceneObjectId, setSelectedSceneObjectId, setSelectedWallId, updateSceneObject } = useProjectStore();
  const selected = selectedSceneObjectId === obj.id;
  const groupRef = React.useRef<THREE.Group>(null);
  
  const fov    = obj.fov ?? 75;
  const range  = obj.range ?? 10;
  const color  = obj.color ?? '#0ea5e9';
  const halfFov = THREE.MathUtils.degToRad(fov / 2);
  const model   = (obj as any).model ?? 'CAM';
  const label   = model.replace('Illustra ', '').split(' ').slice(0, 2).join(' ');

  // Compute visibility polygon
  const r1ToCanvas = (r1: number) => -r1 - Math.PI / 2;
  const shape = useMemo(() => {
    const poly = computeVisibilityPoly(
      obj.position[0], obj.position[2],
      r1ToCanvas(obj.rotation[1]),
      halfFov, range, walls, 60
    );
    const s = new THREE.Shape();
    poly.forEach((p, i) => {
      if (i === 0) s.moveTo(p[0], -p[1]);
      else s.lineTo(p[0], -p[1]);
    });
    s.lineTo(poly[0][0], -poly[0][1]);
    return s;
  }, [obj.position, obj.rotation, fov, range, walls]);

  // --- Custom Drag Logic ---
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef(new THREE.Vector3());
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const controls = useThree((state: any) => state.controls);

  useEffect(() => {
    const handleUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (controls) controls.enabled = true;
      }
    };
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [isDragging, controls]);

  const interact = {
    onPointerDown: (e: any) => { 
      e.stopPropagation(); 
      if (tool === 'select') {
        const target = new THREE.Vector3();
        e.ray.intersectPlane(floorPlane, target);
        dragOffset.current.set(obj.position[0] - target.x, 0, obj.position[2] - target.z);
        setIsDragging(true);
        try { e.target.setPointerCapture(e.pointerId); } catch(err){}
        if (controls) controls.enabled = false;
      }
      if (onObjectClick) onObjectClick('obj', obj.id);
      else { setSelectedSceneObjectId(obj.id); setSelectedWallId(null); }
    },
    onPointerMove: (e: any) => {
      if (isDragging && tool === 'select') {
        e.stopPropagation();
        const target = new THREE.Vector3();
        if (e.ray.intersectPlane(floorPlane, target)) {
          updateSceneObject(obj.id, { 
            position: [target.x + dragOffset.current.x, obj.position[1], target.z + dragOffset.current.z] 
          });
        }
      }
    },
    onPointerUp: (e: any) => {
      if (isDragging) {
        setIsDragging(false);
        try { e.target.releasePointerCapture(e.pointerId); } catch(err){}
        if (controls) controls.enabled = true;
      }
    },
    onPointerOver: (e: any) => { 
      e.stopPropagation(); 
      document.body.style.cursor = tool === 'erase' ? 'crosshair' : tool === 'select' ? 'move' : 'pointer'; 
    },
    onPointerOut: (e: any) => { 
      if (!isDragging) document.body.style.cursor = 'auto'; 
    }
  };

  return (
    <>
      <group ref={groupRef} position={[obj.position[0], obj.position[1], obj.position[2]]} {...interact}>
        {/* Invisible Hitbox for easier selecting/dragging */}
        <mesh>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
        
        <group rotation={[0, obj.rotation[1], 0]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.44, 10]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.22, 0.52]} />
          <meshStandardMaterial color="#2d3748" metalness={0.55} roughness={0.3} emissive={selected ? color : "#000"} emissiveIntensity={selected ? 0.3 : 0} />
        </mesh>
        <mesh position={[0, 0, -0.29]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.068, 0.088, 0.1, 18]} />
          <meshStandardMaterial color="#111" metalness={0.85} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, -0.345]}>
          <circleGeometry args={[0.058, 18]} />
          <meshStandardMaterial color="#001133" metalness={1} roughness={0} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0.12, 0.09, 0.24]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={8} />
        </mesh>
        
        <Billboard position={[0, 0.42, 0]}>
          <Text fontSize={0.26} color={color} anchorX="center" anchorY="bottom" outlineWidth={0.045} outlineColor="#000000">
            {label}
          </Text>
        </Billboard>
      </group>
      </group>

      {/* ── Volumetric FOV – animated scan pulse ── */}
      <AnimatedFOV shape={shape} color={color} camHeight={obj.position[1]} camPos={[obj.position[0], obj.position[2]]} camRange={obj.range ?? 10} />

      {/* ── Wireframe Edges ── */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry thresholdAngle={20}>
          <extrudeGeometry attach="geometry" args={[shape, { depth: obj.position[1], bevelEnabled: false }]} />
        </edgesGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.85} />
      </lineSegments>
    </>
  );
};

// ── Animated FOV with flat DORI floor projection ──────────────────────────────
const AnimatedFOV: React.FC<{ shape: THREE.Shape; color: string; camHeight: number; camPos: [number, number]; camRange: number }> = ({ shape, color, camHeight, camPos, camRange }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    uCamPos: { value: new THREE.Vector2(camPos[0], camPos[1]) },
    uRange: { value: camRange },
    uOpacity: { value: 0.65 } // Opacity of the floor projection
  }), [camPos, camRange]);

  return (
    <group>
      {/* 1. Flat DORI projection on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={1}>
        <extrudeGeometry args={[shape, { depth: 0.01, bevelEnabled: false }]} />
        <shaderMaterial 
          ref={matRef} 
          transparent 
          depthWrite={false} 
          side={THREE.DoubleSide}
          uniforms={uniforms}
          vertexShader={`
            varying vec3 vWorldPos;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPos = worldPosition.xyz;
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `}
          fragmentShader={`
            varying vec3 vWorldPos;
            uniform vec2 uCamPos;
            uniform float uRange;
            uniform float uOpacity;

            void main() {
              float dist = distance(vWorldPos.xz, uCamPos);
              float t = dist / uRange;
              
              vec3 color;
              if (t < 0.15) { color = vec3(1.0, 0.41, 0.70); } // Pink
              else if (t < 0.3) { color = vec3(0.93, 0.26, 0.26); } // Red
              else if (t < 0.5) { color = vec3(0.98, 0.8, 0.08); } // Yellow
              else if (t < 0.7) { color = vec3(0.13, 0.77, 0.36); } // Green
              else if (t < 0.85) { color = vec3(0.02, 0.71, 0.83); } // Cyan
              else { color = vec3(0.23, 0.51, 0.96); } // Blue

              gl_FragColor = vec4(color, uOpacity);
            }
          `}
        />
      </mesh>
      
      {/* 2. Volumetric translucent cone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <extrudeGeometry args={[shape, { depth: camHeight, bevelEnabled: false }]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

function CameraPerspectiveManager({ activeCamId, cameras }: { activeCamId: string | null; cameras: SceneObject[] }) {
  const { camera } = useThree();
  const originalPos = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!activeCamId) {
      if (originalPos.current) {
        camera.position.copy(originalPos.current);
        camera.lookAt(0, 1, 0);
        (camera as THREE.PerspectiveCamera).fov = 45;
        camera.updateProjectionMatrix();
        originalPos.current = null;
      }
      return;
    }
    const camObj = cameras.find(c => c.id === activeCamId);
    if (!camObj) return;

    if (!originalPos.current) originalPos.current = camera.position.clone();

    camera.position.set(camObj.position[0], camObj.position[1] - 0.1, camObj.position[2]);
    const r = camObj.rotation[1];
    const target = new THREE.Vector3(
      camObj.position[0] - Math.sin(r),
      camObj.position[1] - 0.3, // slight downward tilt
      camObj.position[2] - Math.cos(r)
    );
    
    camera.lookAt(target);
    (camera as THREE.PerspectiveCamera).fov = camObj.fov ?? 75;
    camera.updateProjectionMatrix();
  }, [activeCamId, cameras, camera]);

  return null;
}

// ── Scene ──────────────────────────────────────────────────────────────────────
const Scene3D: React.FC<{
  presentationMode: boolean;
  tool: string;
  onFloorClick?: (x: number, z: number) => void;
  onObjectClick?: (type: 'wall' | 'obj', id: string) => void;
}> = ({ presentationMode, tool, onFloorClick, onObjectClick }) => {
  const { walls, sceneObjects, setSelectedWallId, setSelectedSceneObjectId, activeCameraViewId } = useProjectStore();

  const allWalls = useMemo(() => {
    const doorWalls: WallSegment[] = sceneObjects.filter(f => f.type === 'door').map(d => {
      const [bw] = [0.9, 0.15];
      const w = bw * d.scale[0];
      const r = d.rotation[1];
      const dx = Math.cos(r) * (w / 2);
      const dz = Math.sin(r) * (w / 2);
      return {
        id: `door_${d.id}`,
        x1: d.position[0] - dx, y1: d.position[2] - dz,
        x2: d.position[0] + dx, y2: d.position[2] + dz,
        thickness: 0.1, height: 2.1, color: '#000'
      };
    });
    return [...walls, ...doorWalls];
  }, [walls, sceneObjects]);

  const cameras   = sceneObjects.filter(o => o.type === 'camera');
  const furniture = sceneObjects.filter(o => o.type !== 'camera');

  // ── Presentation mode: auto-orbit camera ───────────────────────────────────
  useFrame(({ clock, camera }) => {
    if (!presentationMode || activeCameraViewId) return;
    const t = clock.getElapsedTime() * 0.1;
    camera.position.x = Math.sin(t) * 20;
    camera.position.z = Math.cos(t) * 20;
    camera.position.y = 15;
    camera.lookAt(0, 1, 0);
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight color="#f0f4ff" groundColor="#d1d5db" intensity={0.45} />
      <directionalLight
        position={[10, 22, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25}
        shadow-camera-far={60} shadow-bias={-0.001}
      />
      <directionalLight position={[-8, 10, -8]} intensity={0.4} color="#b0c4ff" />

      <CameraPerspectiveManager activeCamId={activeCameraViewId} cameras={cameras} />

      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.005, 0]} 
        receiveShadow
        onClick={(e) => { 
          e.stopPropagation();
          if (onFloorClick) onFloorClick(e.point.x, e.point.z);
          else { setSelectedWallId(null); setSelectedSceneObjectId(null); }
        }}
        onPointerOver={(e) => {
          if (tool === 'camera' || tool === 'furniture' || tool === 'wall') {
            e.stopPropagation();
            document.body.style.cursor = 'crosshair';
          }
        }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.95} />
      </mesh>

      <Grid
        position={[0, 0.001, 0]} args={[60, 60]}
        cellSize={1} cellThickness={0.4} cellColor="#d1d5db"
        sectionSize={5} sectionThickness={1} sectionColor="#94a3b8"
        fadeDistance={55} fadeStrength={1} followCamera={false} infiniteGrid
      />

      {walls.map(w => <Wall3D key={w.id} wall={w} tool={tool} onObjectClick={onObjectClick} />)}
      {walls.map(wall => <WallBase key={`b_${wall.id}`} wall={wall} />)}
      {furniture.filter(o => o.type !== 'person').map(o => <Furniture3D key={o.id} obj={o} tool={tool} onObjectClick={onObjectClick} />)}
      {furniture.filter(o => o.type === 'person').map(o => {
        const r1ToCanvas = (r1: number) => -r1 - Math.PI / 2;
        const isDetected = cameras.some(cam => {
          const fov = cam.fov ?? 75;
          const range = cam.range ?? 10;
          const halfFov = fov / 2 * Math.PI / 180;
          const poly = computeVisibilityPoly(cam.position[0], cam.position[2], r1ToCanvas(cam.rotation[1]), halfFov, range, allWalls, 60);
          const px = o.position[0], py = o.position[2];
          let inside = false;
          const n = poly.length;
          for (let i = 0, j = n - 1; i < n; j = i++) {
            const [xi, yi] = poly[i], [xj, yj] = poly[j];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
          }
          return inside;
        });
        const ringColor = isDetected ? '#22c55e' : '#ef4444';
        return (
          <group key={o.id}>
            <Furniture3D obj={o} tool={tool} onObjectClick={onObjectClick} />
            <mesh position={[o.position[0], 0.02, o.position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
              <ringGeometry args={[0.28, 0.42, 32]} />
              <meshBasicMaterial color={ringColor} transparent opacity={0.85} depthWrite={false} />
            </mesh>
            <mesh position={[o.position[0], 0.01, o.position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
              <circleGeometry args={[0.5, 32]} />
              <meshBasicMaterial color={ringColor} transparent opacity={0.18} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
      {cameras.map(o => <Camera3D key={o.id} obj={o} walls={allWalls} tool={tool} onObjectClick={onObjectClick} />)}

      <Environment preset="warehouse" background={false} />

      <OrbitControls makeDefault target={[0, 1, 0]} minPolarAngle={0.05} maxPolarAngle={Math.PI / 2 - 0.04} maxDistance={45} minDistance={2} enableDamping dampingFactor={0.08} enabled={!presentationMode && !activeCameraViewId} />
    </>
  );
};

// ── Export ──────────────────────────────────────────────────────────────────────
export default function FloorPlan3D(props: FloorPlan3DProps) {
  const [presenting, setPresenting] = useState(false);
  const { activeCameraViewId, setActiveCameraViewId } = useProjectStore();
  
  return (
    <div style={{ width: '100%', height: '100%', background: '#1e293b', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [0, 18, 22], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={['#1e293b']} />
        <Suspense fallback={null}>
          <Scene3D {...props} presentationMode={presenting} />
        </Suspense>
      </Canvas>

      {/* Camera View Exit Overlay */}
      {activeCameraViewId && (
        <div style={{
          position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          padding: '12px 24px', borderRadius: 99, border: '1px solid #ef4444',
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 50, boxShadow: '0 10px 25px rgba(239,68,68,0.2)'
        }}>
          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
            VISÃO DA CÂMERA
          </span>
          <div style={{ width: 1, height: 24, background: '#334155' }} />
          <button 
            onClick={() => setActiveCameraViewId(null)}
            style={{
              background: 'transparent', border: '1px solid #475569', color: '#cbd5e1',
              padding: '6px 16px', borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Sair da Perspectiva
          </button>
        </div>
      )}

      {/* ── Presentation Mode Button ── */}
      {!activeCameraViewId && (
        <button
          onClick={() => setPresenting(v => !v)}
          style={{
            position: 'absolute', bottom: 16, right: 16,
            background: presenting
              ? 'linear-gradient(135deg, #dc2626, #ef4444)'
              : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
            border: 'none', borderRadius: 12, padding: '10px 20px',
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', boxShadow: presenting ? '0 0 30px rgba(239,68,68,0.5)' : '0 0 20px rgba(37,99,235,0.4)',
            transition: 'all 0.3s',
          }}
        >
          <span style={{ fontSize: 16 }}>{presenting ? '⏹' : '▶'}</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
            {presenting ? 'Parar Apresentação' : 'Modo Apresentação'}
          </span>
        </button>
      )}
    </div>
  );
}
