import React from 'react';
import { SceneObject } from '../../../store/useProjectStore';

export const Furniture3D = ({ obj }: { obj: SceneObject }) => {
  const { type, color } = obj;

  switch (type) {
    case 'wall':
      return (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
        </mesh>
      );

    case 'column':
      return (
        <group>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.5, 1, 20]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
          </mesh>
          {/* Base cap */}
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.05, 20]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
          {/* Top cap */}
          <mesh position={[0, -0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.05, 20]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        </group>
      );

    case 'bed':
      return (
        <group>
          {/* Bed frame */}
          <mesh position={[0, -0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[1, 0.25, 1]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          {/* Mattress */}
          <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.18, 0.88]} />
            <meshStandardMaterial color="#f0ebe3" roughness={0.95} />
          </mesh>
          {/* Pillow */}
          <mesh position={[0, 0.02, -0.35]} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.08, 0.22]} />
            <meshStandardMaterial color="#fff" roughness={1} />
          </mesh>
          {/* Headboard */}
          <mesh position={[0, 0.1, -0.5]} castShadow receiveShadow>
            <boxGeometry args={[1, 0.8, 0.1]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          {/* Footboard */}
          <mesh position={[0, -0.1, 0.5]} castShadow receiveShadow>
            <boxGeometry args={[1, 0.4, 0.08]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        </group>
      );

    case 'sofa':
      return (
        <group>
          {/* Seat base */}
          <mesh position={[0, -0.15, 0.05]} castShadow receiveShadow>
            <boxGeometry args={[1, 0.3, 0.65]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          {/* Seat cushion */}
          <mesh position={[0, 0.05, 0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.95, 0.18, 0.55]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          {/* Backrest */}
          <mesh position={[0, 0.22, -0.28]} castShadow receiveShadow>
            <boxGeometry args={[1, 0.52, 0.18]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          {/* Left arm */}
          <mesh position={[-0.44, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.14, 0.4, 0.65]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* Right arm */}
          <mesh position={[0.44, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.14, 0.4, 0.65]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* Legs */}
          {[[-0.42, -0.3], [-0.42, 0.32], [0.42, -0.3], [0.42, 0.32]].map(([x, z], i) => (
            <mesh key={i} position={[x, -0.35, z]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.15, 8]} />
              <meshStandardMaterial color="#4a4a4a" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );

    case 'chair':
      return (
        <group>
          {/* Seat */}
          <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.55, 0.1, 0.55]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* Backrest */}
          <mesh position={[0, 0.37, -0.23]} castShadow receiveShadow>
            <boxGeometry args={[0.55, 0.5, 0.08]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* 4 legs */}
          {[[-0.22, -0.22], [-0.22, 0.22], [0.22, -0.22], [0.22, 0.22]].map(([x, z], i) => (
            <mesh key={i} position={[x, -0.25, z]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.6, 8]} />
              <meshStandardMaterial color="#2d2d2d" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );

    case 'table':
      return (
        <group>
          {/* Tabletop */}
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[1, 0.06, 1]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
          </mesh>
          {/* 4 Legs */}
          {[[-0.44, -0.44], [-0.44, 0.44], [0.44, -0.44], [0.44, 0.44]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.12, z]} castShadow receiveShadow>
              <boxGeometry args={[0.06, 0.72, 0.06]} />
              <meshStandardMaterial color="#3d3d3d" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    case 'person': {
      // Height-scale driven by obj.scale[1] (default 1.0 = 1.75m)
      const hScale = obj.scale?.[1] ?? 1.0;
      const skin = color ?? '#4fb8f7';

      // Helper: capsule-like body part via squished sphere
      const Part = ({
        pos, radius, height, rot
      }: {
        pos: [number, number, number];
        radius: number;
        height: number;
        rot?: [number, number, number];
      }) => (
        <mesh position={pos} rotation={rot ?? [0, 0, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[radius, height, 8, 16]} />
          <meshStandardMaterial color={skin} roughness={0.4} metalness={0.05} />
        </mesh>
      );

      const h = hScale * 1.75; // total height in meters
      const head = h * 0.14;   // head radius
      const torsoH = h * 0.28;
      const torsoR = h * 0.085;
      const limbR  = h * 0.042;
      const armH   = h * 0.22;
      const legH   = h * 0.26;
      const baseY  = -h / 2;   // feet at y=0 after group translate

      return (
        <group position={[0, h / 2, 0]} castShadow>
          {/* Head */}
          <mesh position={[0, torsoH / 2 + head * 1.05, 0]} castShadow receiveShadow>
            <sphereGeometry args={[head, 16, 16]} />
            <meshStandardMaterial color={skin} roughness={0.35} metalness={0.05} />
          </mesh>

          {/* Torso */}
          <Part pos={[0, 0, 0]} radius={torsoR} height={torsoH} />

          {/* Pelvis connection */}
          <mesh position={[0, -torsoH / 2, 0]} castShadow receiveShadow>
            <sphereGeometry args={[torsoR * 1.15, 12, 12]} />
            <meshStandardMaterial color={skin} roughness={0.4} />
          </mesh>

          {/* Left Arm – angled outward */}
          <group position={[-(torsoR + limbR * 1.5), torsoH * 0.2, 0]} rotation={[0, 0, 0.45]}>
            <Part pos={[0, -armH / 2, 0]} radius={limbR} height={armH} />
            {/* Elbow ball */}
            <mesh position={[0, -armH, 0]} castShadow receiveShadow>
              <sphereGeometry args={[limbR * 1.05, 10, 10]} />
              <meshStandardMaterial color={skin} roughness={0.4} />
            </mesh>
            {/* Forearm */}
            <Part pos={[-armH * 0.18, -armH * 1.5, 0]} radius={limbR * 0.88} height={armH * 0.85} rot={[0, 0, 0.25]} />
          </group>

          {/* Right Arm – angled outward */}
          <group position={[torsoR + limbR * 1.5, torsoH * 0.2, 0]} rotation={[0, 0, -0.45]}>
            <Part pos={[0, -armH / 2, 0]} radius={limbR} height={armH} />
            <mesh position={[0, -armH, 0]} castShadow receiveShadow>
              <sphereGeometry args={[limbR * 1.05, 10, 10]} />
              <meshStandardMaterial color={skin} roughness={0.4} />
            </mesh>
            <Part pos={[armH * 0.18, -armH * 1.5, 0]} radius={limbR * 0.88} height={armH * 0.85} rot={[0, 0, -0.25]} />
          </group>

          {/* Left Leg – spread slightly */}
          <group position={[-torsoR * 0.65, -torsoH / 2, 0]} rotation={[0, 0, 0.1]}>
            <Part pos={[0, -legH / 2, 0]} radius={limbR * 1.1} height={legH} />
            {/* Knee */}
            <mesh position={[0, -legH, 0]} castShadow receiveShadow>
              <sphereGeometry args={[limbR * 1.05, 10, 10]} />
              <meshStandardMaterial color={skin} roughness={0.4} />
            </mesh>
            {/* Shin */}
            <Part pos={[0, -legH * 1.55, 0]} radius={limbR * 0.88} height={legH * 0.85} />
          </group>

          {/* Right Leg */}
          <group position={[torsoR * 0.65, -torsoH / 2, 0]} rotation={[0, 0, -0.1]}>
            <Part pos={[0, -legH / 2, 0]} radius={limbR * 1.1} height={legH} />
            <mesh position={[0, -legH, 0]} castShadow receiveShadow>
              <sphereGeometry args={[limbR * 1.05, 10, 10]} />
              <meshStandardMaterial color={skin} roughness={0.4} />
            </mesh>
            <Part pos={[0, -legH * 1.55, 0]} radius={limbR * 0.88} height={legH * 0.85} />
          </group>
        </group>
      );
    }

    case 'car': {
      // Dimensions
      const carW = obj.scale[0] * 4.5; // length
      const carH = obj.scale[1] * 1.5; // height
      const carD = obj.scale[2] * 1.8; // width (depth in 3d)
      const wheelR = 0.3;
      const wheelW = 0.2;
      
      return (
        <group position={[0, carH/2 + wheelR, 0]} castShadow>
          {/* Main body (chassis) */}
          <mesh position={[0, -carH * 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[carW, carH * 0.4, carD]} />
            <meshStandardMaterial color={color ?? '#334155'} roughness={0.3} metalness={0.6} />
          </mesh>
          
          {/* Cabin (top) */}
          <mesh position={[-carW * 0.1, carH * 0.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[carW * 0.5, carH * 0.4, carD * 0.9]} />
            <meshStandardMaterial color={color ?? '#334155'} roughness={0.3} metalness={0.6} />
          </mesh>
          
          {/* Windows (dark glass) */}
          <mesh position={[-carW * 0.1, carH * 0.15, 0]}>
            <boxGeometry args={[carW * 0.51, carH * 0.38, carD * 0.91]} />
            <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} transparent opacity={0.8} />
          </mesh>

          {/* Wheels */}
          { [
            [carW*0.3, carD*0.45], [carW*0.3, -carD*0.45],
            [-carW*0.35, carD*0.45], [-carW*0.35, -carD*0.45]
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, -carH/2, z]} rotation={[Math.PI/2, 0, 0]} castShadow>
              <cylinderGeometry args={[wheelR, wheelR, wheelW, 16]} />
              <meshStandardMaterial color="#1e293b" roughness={0.9} />
            </mesh>
          ))}
          
          {/* Headlights */}
          <mesh position={[carW/2, -carH * 0.15, carD * 0.35]}>
            <boxGeometry args={[0.05, 0.15, 0.2]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[carW/2, -carH * 0.15, -carD * 0.35]}>
            <boxGeometry args={[0.05, 0.15, 0.2]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          
          {/* License plate (front & back) */}
          <mesh position={[carW/2 + 0.01, -carH * 0.3, 0]}>
            <planeGeometry args={[0.4, 0.15]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[-carW/2 - 0.01, -carH * 0.3, 0]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.4, 0.15]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
        </group>
      );
    }

    default:
      return null;
  }
};
