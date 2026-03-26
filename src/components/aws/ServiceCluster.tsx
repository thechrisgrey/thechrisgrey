import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ClusterData } from '../../data/infrastructureTopology';

interface ServiceClusterProps {
  cluster: ClusterData;
  isSelected: boolean;
  onClick: () => void;
}

export function ServiceCluster({ cluster, isSelected, onClick }: ServiceClusterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const baseY = cluster.position[1];

  useFrame(({ clock }) => {
    if (!groupRef.current || isSelected) return;
    const t = clock.elapsedTime;
    groupRef.current.position.y = baseY + Math.sin(t * 1.2) * 0.03;
  });

  const opacity = isSelected ? 0.8 : hovered ? 0.55 : 0.3;

  return (
    <group
      ref={groupRef}
      position={cluster.position}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Wireframe sphere */}
      <mesh>
        <sphereGeometry args={[cluster.size, 16, 16]} />
        <meshBasicMaterial
          wireframe
          color="#C5A572"
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Cluster label */}
      <Text
        position={[0, cluster.size + 0.15, 0]}
        color={hovered || isSelected ? '#C5A572' : '#9BA6B8'}
        fontSize={0.2}
        anchorX="center"
        anchorY="middle"
      >
        {cluster.label}
      </Text>

      {/* Service count */}
      <Text
        position={[0, cluster.size + 0.35, 0]}
        color="#9BA6B8"
        fontSize={0.12}
        anchorX="center"
        anchorY="middle"
      >
        {`${cluster.services.length} service${cluster.services.length !== 1 ? 's' : ''}`}
      </Text>
    </group>
  );
}
