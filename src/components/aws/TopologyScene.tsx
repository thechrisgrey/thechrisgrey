import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';
import { clusters } from '../../data/infrastructureTopology';
import { ServiceCluster } from './ServiceCluster';
import { ClusterEdge } from './ClusterEdge';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 2, 8);

/** Deduplicated list of connection edges from cluster data. */
function buildEdges(): { key: string; start: [number, number, number]; end: [number, number, number] }[] {
  const drawn = new Set<string>();
  const edges: { key: string; start: [number, number, number]; end: [number, number, number] }[] = [];

  for (const cluster of clusters) {
    for (const targetId of cluster.connections) {
      const pairKey = [cluster.id, targetId].sort().join('-');
      if (drawn.has(pairKey)) continue;
      drawn.add(pairKey);

      const target = clusters.find((c) => c.id === targetId);
      if (target) {
        edges.push({ key: pairKey, start: cluster.position, end: target.position });
      }
    }
  }

  return edges;
}

const edges = buildEdges();

// ------------------------------------------------------------------
// Inner scene component (must be inside <Canvas> for R3F hooks)
// ------------------------------------------------------------------

interface SceneContentProps {
  selectedClusterId: string | null;
  onSelectCluster: (id: string | null) => void;
  frameloopMode: 'always' | 'demand';
  setFrameloopMode: (mode: 'always' | 'demand') => void;
  controlRef?: React.MutableRefObject<TopologyControlHandle | null>;
}

function SceneContent({
  selectedClusterId,
  onSelectCluster,
  frameloopMode,
  setFrameloopMode,
  controlRef,
}: SceneContentProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Expose control handle for external rotate/reset buttons
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      rotateBy: (angleDeg: number) => {
        if (!controlsRef.current) return;
        const angleRad = (angleDeg * Math.PI) / 180;
        const controls = controlsRef.current;
        const currentAngle = controls.getAzimuthalAngle();
        const targetAngle = currentAngle + angleRad;
        if (reducedMotion) {
          controls.minAzimuthAngle = -Infinity;
          controls.maxAzimuthAngle = Infinity;
          // Rotate camera around target
          const offset = camera.position.clone().sub(controls.target);
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);
          camera.position.copy(controls.target).add(offset);
          controls.update();
          invalidate();
        } else {
          const dummy = { angle: currentAngle };
          controls.minAzimuthAngle = -Infinity;
          controls.maxAzimuthAngle = Infinity;
          gsap.to(dummy, {
            angle: targetAngle,
            duration: 0.6,
            ease: 'power2.out',
            onUpdate: () => {
              const delta = dummy.angle - controls.getAzimuthalAngle();
              const offset = camera.position.clone().sub(controls.target);
              offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
              camera.position.copy(controls.target).add(offset);
              controls.update();
              invalidate();
            },
          });
        }
      },
      zoomBy: (delta: number) => {
        // Move camera along its forward direction
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const dest = camera.position.clone().addScaledVector(direction, delta);
        // Clamp distance from origin to stay within OrbitControls bounds
        const dist = dest.length();
        if (dist < 4 || dist > 14) return;
        if (reducedMotion) {
          camera.position.copy(dest);
          invalidate();
        } else {
          gsap.to(camera.position, {
            x: dest.x,
            y: dest.y,
            z: dest.z,
            duration: 0.4,
            ease: 'power2.out',
            onUpdate: () => invalidate(),
          });
        }
      },
      reset: () => {
        onSelectCluster(null);
        setFrameloopMode('always');
        if (reducedMotion) {
          camera.position.set(DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z);
          invalidate();
        } else {
          gsap.to(camera.position, {
            x: DEFAULT_CAMERA_POS.x,
            y: DEFAULT_CAMERA_POS.y,
            z: DEFAULT_CAMERA_POS.z,
            duration: 0.8,
            ease: 'power2.out',
            onUpdate: () => invalidate(),
          });
        }
      },
      flyTo: (clusterId: string) => {
        const cluster = clusters.find((c) => c.id === clusterId);
        if (!cluster) return;
        onSelectCluster(clusterId);
        setFrameloopMode('demand');
        const target = new THREE.Vector3(...cluster.position);
        const dest = new THREE.Vector3().lerpVectors(DEFAULT_CAMERA_POS, target, 0.25);
        dest.z = Math.max(dest.z, target.z + 2);
        if (reducedMotion) {
          camera.position.set(dest.x, dest.y, dest.z);
          invalidate();
        } else {
          gsap.to(camera.position, {
            x: dest.x, y: dest.y, z: dest.z,
            duration: 0.8,
            ease: 'power2.out',
            onUpdate: () => invalidate(),
            onComplete: () => invalidate(),
          });
        }
      },
    };
  }, [controlRef, camera, invalidate, reducedMotion, onSelectCluster, setFrameloopMode]);

  // Track whether auto-rotate should be active (disabled under reduced motion)
  const autoRotate = !reducedMotion && selectedClusterId === null;

  // Pause auto-rotation when tab is hidden
  useFrame(() => {
    if (document.hidden && controlsRef.current) {
      controlsRef.current.autoRotate = false;
    } else if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  });

  const handleClusterClick = useCallback(
    (id: string) => {
      const cluster = clusters.find((c) => c.id === id);
      if (!cluster) return;

      onSelectCluster(id);
      setFrameloopMode('demand');

      // Animate camera toward the selected cluster (60% lerp toward it)
      const target = new THREE.Vector3(...cluster.position);
      const dest = new THREE.Vector3().lerpVectors(DEFAULT_CAMERA_POS, target, 0.25);
      // Keep a minimum distance from the cluster so it remains visible
      dest.z = Math.max(dest.z, target.z + 2);

      if (reducedMotion) {
        // Instant camera jump — no tween
        camera.position.set(dest.x, dest.y, dest.z);
        invalidate();
      } else {
        gsap.to(camera.position, {
          x: dest.x,
          y: dest.y,
          z: dest.z,
          duration: 0.8,
          ease: 'power2.out',
          onUpdate: () => invalidate(),
          onComplete: () => invalidate(),
        });
      }
    },
    [camera.position, onSelectCluster, setFrameloopMode, invalidate, reducedMotion],
  );

  const handleDeselect = useCallback(() => {
    onSelectCluster(null);
    setFrameloopMode('always');

    if (reducedMotion) {
      // Instant camera return — no tween
      camera.position.set(DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z);
      invalidate();
    } else {
      gsap.to(camera.position, {
        x: DEFAULT_CAMERA_POS.x,
        y: DEFAULT_CAMERA_POS.y,
        z: DEFAULT_CAMERA_POS.z,
        duration: 0.8,
        ease: 'power2.out',
        onUpdate: () => invalidate(),
      });
    }
  }, [camera.position, onSelectCluster, setFrameloopMode, invalidate, reducedMotion]);

  // Escape key to deselect
  useEffect(() => {
    if (!selectedClusterId) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDeselect();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedClusterId, handleDeselect]);

  // Invalidate on demand mode so the scene still renders after state changes
  useEffect(() => {
    if (frameloopMode === 'demand') invalidate();
  }, [frameloopMode, selectedClusterId, invalidate]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2, 8]} fov={50} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#C5A572" />

      <OrbitControls
        ref={controlsRef}
        autoRotate={autoRotate}
        autoRotateSpeed={0.2}
        enableZoom={false}
        enablePan={false}
      />

      {/* Click on empty space to deselect */}
      <mesh visible={false} onPointerDown={handleDeselect}>
        <sphereGeometry args={[50, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>

      {/* Edges */}
      {edges.map((edge) => (
        <ClusterEdge key={edge.key} start={edge.start} end={edge.end} />
      ))}

      {/* Clusters */}
      {clusters.map((cluster) => (
        <ServiceCluster
          key={cluster.id}
          cluster={cluster}
          isSelected={selectedClusterId === cluster.id}
          onClick={() => handleClusterClick(cluster.id)}
        />
      ))}

    </>
  );
}

// ------------------------------------------------------------------
// Public component
// ------------------------------------------------------------------

interface TopologySceneProps {
  /** Externally-controlled selected cluster (lifted state). Falls back to internal state when omitted. */
  selectedClusterId?: string | null;
  /** Callback when a cluster is selected or deselected. */
  onSelectCluster?: (id: string | null) => void;
  /** Ref for external control (rotate, reset) */
  controlRef?: React.MutableRefObject<TopologyControlHandle | null>;
}

export interface TopologyControlHandle {
  rotateBy: (angleDeg: number) => void;
  zoomBy: (delta: number) => void;
  reset: () => void;
  flyTo: (clusterId: string) => void;
}

export function TopologyScene({ selectedClusterId: externalId, onSelectCluster: externalOnSelect, controlRef }: TopologySceneProps = {}) {
  const [internalId, setInternalId] = useState<string | null>(null);
  const [frameloopMode, setFrameloopMode] = useState<'always' | 'demand'>('always');

  // Use external state when provided, otherwise fall back to internal state
  const selectedClusterId = externalId !== undefined ? externalId : internalId;
  const onSelectCluster = externalOnSelect ?? setInternalId;

  return (
    <Canvas
      frameloop={frameloopMode}
      style={{ width: '100%', height: '100%', background: '#0A0F1C' }}
    >
      <Suspense fallback={null}>
        <SceneContent
          selectedClusterId={selectedClusterId}
          onSelectCluster={onSelectCluster}
          frameloopMode={frameloopMode}
          setFrameloopMode={setFrameloopMode}
          controlRef={controlRef}
        />
      </Suspense>
    </Canvas>
  );
}
