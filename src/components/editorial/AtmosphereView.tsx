import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// eslint-disable-next-line react-refresh/only-export-components
export const PARTICLE_BOUNDS = { x: 3, y: 1.6, z: 1 };
const DRIFT_SPEED = 0.045; // units/second — barely-there rise

/** Pure drift step, exported for unit testing. Wraps at the top bound. */
// eslint-disable-next-line react-refresh/only-export-components
export function advanceParticleY(y: number, dt: number): number {
  const next = y + DRIFT_SPEED * dt;
  return next > PARTICLE_BOUNDS.y ? -PARTICLE_BOUNDS.y : next;
}

interface DustProps {
  count: number;
}

function Dust({ count }: DustProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { invalidate } = useThree();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.x;
      arr[i * 3 + 1] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.y;
      arr[i * 3 + 2] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.z;
    }
    return arr;
  }, [count]);

  // 30fps invalidation cap: with frameloop="demand" the dust drives its own
  // clock instead of forcing a 60fps loop on the whole shared canvas.
  useEffect(() => {
    const id = setInterval(() => invalidate(), 33);
    return () => clearInterval(id);
  }, [invalidate]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const pos = points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, advanceParticleY(pos.getY(i), Math.min(delta, 0.1)));
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#C5A572"
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.28}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

interface AtmosphereViewProps {
  /** Positions the View's own div inside the hero scene tile. */
  className?: string;
  /** Lower particle count on coarse-pointer (mobile) devices. */
  mobile?: boolean;
}

/** Sparse gold-dust drift behind the hero — quiet depth, never busy.
 *  View-as-element per the EditorialCanvas consumer contract. */
const AtmosphereView = ({ className = 'pointer-events-none absolute inset-0', mobile = false }: AtmosphereViewProps) => (
  <View className={className}>
    <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={50} />
    <Dust count={mobile ? 150 : 400} />
  </View>
);

export default AtmosphereView;
