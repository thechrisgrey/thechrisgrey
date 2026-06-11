import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// eslint-disable-next-line react-refresh/only-export-components
export const PARTICLE_BOUNDS = { x: 3, y: 1.6, z: 1 };
const DRIFT_SPEED = 0.045; // units/second — barely-there rise
const MAX_PARTICLES = 400; // buffer capacity; active count selected via drawRange

/** Pure drift step, exported for unit testing. Wraps modularly past the top
 *  bound — overshoot carries into the re-entry so drift speed stays exact. */
// eslint-disable-next-line react-refresh/only-export-components
export function advanceParticleY(y: number, dt: number): number {
  const next = y + DRIFT_SPEED * dt;
  return next > PARTICLE_BOUNDS.y ? next - 2 * PARTICLE_BOUNDS.y : next;
}

interface DustProps {
  count: number;
  active: boolean;
}

function Dust({ count, active }: DustProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const invalidate = useThree((s) => s.invalidate);

  // Allocate the full capacity once; count flips (mobile breakpoint) only move
  // drawRange instead of reallocating the GL buffer and teleporting particles.
  const positions = useMemo(() => {
    const arr = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      arr[i * 3] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.x;
      arr[i * 3 + 1] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.y;
      arr[i * 3 + 2] = (Math.random() * 2 - 1) * PARTICLE_BOUNDS.z;
    }
    return arr;
  }, []);

  // 30fps invalidation cap: with frameloop="demand" the dust drives its own
  // clock instead of forcing a 60fps loop on the whole shared canvas.
  // Keyed on [active, invalidate] — interval is skipped entirely when inactive.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => invalidate(), 33);
    return () => clearInterval(id);
  }, [active, invalidate]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const pos = points.geometry.attributes.position;
    // Advance only the active subset — capacity (pos.count) exceeds `count`.
    for (let i = 0; i < count; i++) {
      pos.setY(i, advanceParticleY(pos.getY(i), Math.min(delta, 0.1)));
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry drawRange={{ start: 0, count }}>
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
 *  View-as-element per the EditorialCanvas consumer contract.
 *  Self-gating via IntersectionObserver: the 30Hz interval pauses while
 *  the hero is scrolled offscreen and resumes on return. */
const AtmosphereView = ({ className = 'pointer-events-none absolute inset-0', mobile = false }: AtmosphereViewProps) => {
  const viewRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const el = viewRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <View ref={viewRef as never} className={className}>
      <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={50} />
      <Dust count={mobile ? 150 : 400} active={active} />
    </View>
  );
};

export default AtmosphereView;
