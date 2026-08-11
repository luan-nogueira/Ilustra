import React, { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore, SceneObject, WallSegment } from '../../store/useProjectStore';
import { createPlateTexture } from '../../utils/plateTexture';

// Lightweight, non-interactive scene renderer used for the multi-camera "VMS" grid —
// each tile gets its own tiny live 3D viewport rendered from that camera's real
// position / height / tilt / FOV, instead of a static placeholder icon.

const FURN_DIMS: Record<string, [number, number, number]> = {
  chair: [0.6, 0.85, 0.6], table: [1.4, 0.75, 0.7], sofa: [2.0, 0.85, 0.9],
  bed: [1.6, 0.5, 2.0], column: [0.5, 2.8, 0.5], person: [0.5, 1.75, 0.5],
  reader: [0.2, 0.25, 0.05], controller: [0.5, 0.6, 0.15], door: [0.9, 2.1, 0.1],
  rack: [0.6, 2.0, 0.9], door_heavy: [1.2, 2.2, 0.15], door_sliding: [1.6, 2.1, 0.08],
  door_auto: [1.6, 2.2, 0.12], car: [4.5, 1.5, 1.8],
};

function FeedCameraRig({ camObj }: { camObj: SceneObject }) {
  useFrame(({ camera }) => {
    camera.position.set(camObj.position[0], camObj.position[1] - 0.05, camObj.position[2]);
    const r = camObj.rotation[1];
    const tiltRad = THREE.MathUtils.degToRad(camObj.tilt ?? 15);
    const target = new THREE.Vector3(
      camObj.position[0] - Math.sin(r),
      camObj.position[1] - Math.tan(tiltRad),
      camObj.position[2] - Math.cos(r),
    );
    camera.lookAt(target);
    const persp = camera as THREE.PerspectiveCamera;
    persp.fov = camObj.fov ?? 75;
    persp.updateProjectionMatrix();
  });
  return null;
}

const SimpleWall: React.FC<{ wall: WallSegment }> = ({ wall }) => {
  const dx = wall.x2 - wall.x1, dz = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dz);
  const rotY = -Math.atan2(dz, dx);
  const cx = (wall.x1 + wall.x2) / 2, cz = (wall.y1 + wall.y2) / 2;
  return (
    <mesh position={[cx, wall.height / 2, cz]} rotation={[0, rotY, 0]}>
      <boxGeometry args={[length + wall.thickness, wall.height, wall.thickness]} />
      <meshStandardMaterial color={wall.color || '#f8fafc'} roughness={0.9} />
    </mesh>
  );
};

const SimpleCar: React.FC<{ obj: SceneObject }> = ({ obj }) => {
  const [carW, carH, carD] = FURN_DIMS.car;
  const plateTex = useMemo(() => createPlateTexture(obj.plate ?? '---'), [obj.plate]);
  return (
    <group position={[obj.position[0], obj.position[1], obj.position[2]]} rotation={[0, obj.rotation[1], 0]}>
      <group position={[0, carH / 2 + 0.28, 0]}>
        <mesh position={[0, -carH * 0.25, 0]}>
          <boxGeometry args={[carW, carH * 0.4, carD]} />
          <meshStandardMaterial color={obj.color ?? '#334155'} roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[-carW * 0.1, carH * 0.15, 0]}>
          <boxGeometry args={[carW * 0.5, carH * 0.4, carD * 0.9]} />
          <meshStandardMaterial color={obj.color ?? '#334155'} roughness={0.3} metalness={0.6} />
        </mesh>
        {/* License plates – same procedural texture/orientation as the main floor-plan view */}
        <mesh position={[carW / 2 + 0.01, -carH * 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.4, 0.15]} />
          <meshStandardMaterial map={plateTex} />
        </mesh>
        <mesh position={[-carW / 2 - 0.01, -carH * 0.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.4, 0.15]} />
          <meshStandardMaterial map={plateTex} />
        </mesh>
      </group>
    </group>
  );
};

const SimpleFurniture: React.FC<{ obj: SceneObject }> = ({ obj }) => {
  if (obj.type === 'car') return <SimpleCar obj={obj} />;
  const [w, h, d] = FURN_DIMS[obj.type] ?? [1, 0.8, 1];
  return (
    <mesh
      position={[obj.position[0], obj.position[1] + h / 2, obj.position[2]]}
      rotation={[0, obj.rotation[1], 0]}
      scale={[obj.scale[0], 1, obj.scale[2]]}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={obj.color ?? '#94a3b8'} roughness={0.75} />
    </mesh>
  );
};

export const CameraFeedCanvas: React.FC<{ camObj: SceneObject }> = ({ camObj }) => {
  const walls = useProjectStore(s => s.walls);
  const sceneObjects = useProjectStore(s => s.sceneObjects);
  const furniture = sceneObjects.filter(o => o.type !== 'camera' && o.id !== camObj.id);

  return (
    <Canvas
      dpr={1}
      shadows={false}
      gl={{ antialias: false, powerPreference: 'low-power' }}
      camera={{ fov: camObj.fov ?? 75, near: 0.1, far: 200 }}
    >
      <color attach="background" args={['#0b1220']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 20, 10]} intensity={1.1} />
      <hemisphereLight color="#dbeafe" groundColor="#94a3b8" intensity={0.4} />
      <FeedCameraRig camObj={camObj} />
      {walls.map(w => <SimpleWall key={w.id} wall={w} />)}
      {furniture.map(o => <SimpleFurniture key={o.id} obj={o} />)}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.95} />
      </mesh>
    </Canvas>
  );
};
