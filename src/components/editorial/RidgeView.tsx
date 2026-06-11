import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ridgeVertexShader, ridgeFragmentShader } from './ridgeShader';

const COLOR_GOLD = new THREE.Color('#C5A572');
const COLOR_PORCELAIN = new THREE.Color('#F2EFE9');

function RidgeTerrain() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { invalidate } = useThree();
  const startRef = useRef<number | null>(null);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uAmp: { value: 0.55 },
      uColorGold: { value: COLOR_GOLD.clone() },
      uColorPorcelain: { value: COLOR_PORCELAIN.clone() },
    }),
    []
  );

  // Draw-in once (~1.8s, power3-like curve), then never invalidate again —
  // with frameloop="demand" the settled ridge costs zero per-frame GPU work.
  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat) return;
    if (mat.uniforms.uProgress.value >= 1) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const t = Math.min((state.clock.elapsedTime - startRef.current) / 1.8, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    mat.uniforms.uProgress.value = eased;
    if (t < 1) invalidate();
  });

  return (
    <mesh rotation={[-Math.PI / 2.35, 0, 0]} position={[0, -0.55, 0]}>
      <planeGeometry args={[6, 3, 160, 80]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={ridgeVertexShader}
        fragmentShader={ridgeFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface RidgeViewProps {
  /** Positions the View's own div inside the hero scene tile. */
  className?: string;
}

/**
 * Live contour-line terrain rendered into the hero scene tile. drei 10's
 * out-of-canvas View renders AND tracks its own div (the `track` prop is dead
 * in that path) — so the View must BE the positioned element.
 */
const RidgeView = ({ className = 'pointer-events-none absolute inset-0' }: RidgeViewProps) => (
  <View className={className}>
    <PerspectiveCamera makeDefault position={[0, 0.7, 2.4]} fov={40} />
    <RidgeTerrain />
  </View>
);

export default RidgeView;
