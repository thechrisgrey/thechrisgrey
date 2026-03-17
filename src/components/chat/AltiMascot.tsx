import { Suspense, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function AltiModel({ onHoverChange }: { onHoverChange: (h: boolean) => void }) {
  const { scene } = useGLTF('/alti.glb');
  const groupRef = useRef<THREE.Group>(null);
  const hoveredRef = useRef(false);
  const liftRef = useRef(0);
  const baseY = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // Gentle idle float — slow sine wave, small amplitude
    const float = Math.sin(clock.elapsedTime * 1.5) * 0.05;

    // Hover lift lerp — elevates on hover
    const liftTarget = hoveredRef.current ? 0.15 : 0;
    liftRef.current = THREE.MathUtils.lerp(liftRef.current, liftTarget, 0.08);

    groupRef.current.position.y = baseY.current + float + liftRef.current;
  });

  return (
    <group
      ref={groupRef}
      onPointerEnter={(e) => {
        e.stopPropagation();
        hoveredRef.current = true;
        onHoverChange(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        hoveredRef.current = false;
        onHoverChange(false);
      }}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/alti.glb');

interface AltiMascotProps {
  isOpen: boolean;
}

const AltiMascot = ({ isOpen }: AltiMascotProps) => {
  const [hovered, setHovered] = useState(false);
  const handleHoverChange = useCallback((h: boolean) => setHovered(h), []);

  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16" style={{ pointerEvents: 'none' }}>
        <Canvas
          frameloop="always"
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, 3], fov: 45 }}
          style={{ pointerEvents: 'auto' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 2, 5]} intensity={0.8} />
          <Suspense fallback={null}>
            <AltiModel onHoverChange={handleHoverChange} />
          </Suspense>
        </Canvas>
      </div>
      {/* Platform — gold glow, intensifies on hover */}
      <div
        className="w-14 h-4 rounded-[50%] flex items-center justify-center"
        style={{
          marginTop: '-6px',
          background: hovered
            ? 'radial-gradient(ellipse at center, rgba(197,165,114,0.7) 0%, rgba(197,165,114,0.3) 50%, transparent 100%)'
            : 'radial-gradient(ellipse at center, rgba(197,165,114,0.5) 0%, rgba(197,165,114,0.15) 50%, transparent 100%)',
          boxShadow: hovered
            ? '0 0 16px 6px rgba(197,165,114,0.4), 0 0 32px 12px rgba(197,165,114,0.15)'
            : '0 0 12px 4px rgba(197,165,114,0.2), 0 0 24px 8px rgba(197,165,114,0.08)',
          transition: 'background 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        {isOpen && (
          <span className="material-icons text-altivum-silver text-[10px] leading-none">
            close
          </span>
        )}
      </div>
    </div>
  );
};

export default AltiMascot;
