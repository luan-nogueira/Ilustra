import React, { useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface Camera3DNodeProps {
  color?: string;
  fov?: number;   // full opening angle in degrees
  range?: number; // in scene units
}

export const Camera3DNode: React.FC<Camera3DNodeProps> = ({
  color = '#00d2ff',
  fov = 75,
  range = 8,
}) => {
  const halfFovRad = THREE.MathUtils.degToRad(fov / 2);
  const baseRadius = Math.tan(halfFovRad) * range;

  // Build the outline lines of the cone in -Z direction
  // Points around the base circle
  const N = 32;
  const circlePoints: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const angle = (i / N) * Math.PI * 2;
    circlePoints.push([
      Math.cos(angle) * baseRadius,
      Math.sin(angle) * baseRadius,
      -range,
    ]);
  }
  // 4 lines from tip to base circle edge
  const edgeLines: [number, number, number][][] = [0, N / 4, N / 2, (3 * N) / 4].map(i => {
    const angle = (i / N) * Math.PI * 2;
    return [
      [0, 0, 0] as [number, number, number],
      [Math.cos(angle) * baseRadius, Math.sin(angle) * baseRadius, -range],
    ];
  });

  return (
    <group>
      {/* ── Camera housing – mounting arm ── */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.36, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.32, 0.22, 0.52]} />
        <meshStandardMaterial color="#37474f" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Lens barrel */}
      <mesh position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.12, 20]} />
        <meshStandardMaterial color="#263238" metalness={0.8} roughness={0.15} />
      </mesh>
      {/* Lens glass */}
      <mesh position={[0, 0, -0.37]}>
        <circleGeometry args={[0.07, 20]} />
        <meshStandardMaterial color="#001133" metalness={1} roughness={0} transparent opacity={0.9} />
      </mesh>
      {/* Status LED */}
      <mesh position={[0.13, 0.09, 0.26]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={8} />
      </mesh>
      {/* Brand label plate */}
      <mesh position={[0, -0.09, 0]} castShadow>
        <boxGeometry args={[0.2, 0.04, 0.5]} />
        <meshStandardMaterial color="#546e7a" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* ── FOV Cone solid ──
          ConeGeometry: tip at +Y, base at -Y (height/2 each).
          rotation [-π/2, 0, 0] → +Y becomes -Z.
          position [0, 0, -range/2] → tip at z=0, base at z=-range. ── */}
      <mesh
        position={[0, 0, -range / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <coneGeometry args={[baseRadius, range, 48, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── FOV Cone wireframe outline (much more visible) ── */}
      {/* Base circle */}
      <Line
        points={circlePoints}
        color={color}
        lineWidth={1.5}
        transparent
        opacity={0.7}
      />
      {/* 4 edge lines from origin to base */}
      {edgeLines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={color}
          lineWidth={1.5}
          transparent
          opacity={0.6}
        />
      ))}
      {/* Small circle at lens */}
      <Line
        points={[...Array(21)].map((_, i) => {
          const a = (i / 20) * Math.PI * 2;
          return [Math.cos(a) * 0.09, Math.sin(a) * 0.09, -0.38] as [number, number, number];
        })}
        color={color}
        lineWidth={2}
        transparent
        opacity={0.9}
      />
    </group>
  );
};
