import { useState } from 'react';
import { clusters } from '../../data/infrastructureTopology';
import { FallbackCluster } from './FallbackCluster';
import { FallbackDetail } from './FallbackDetail';

/** Map a cluster's 3D position to 2D SVG coordinates (ignore Z). */
function toSvg(position: [number, number, number]): { cx: number; cy: number } {
  return {
    cx: (position[0] + 4) * 60 + 50,
    cy: (position[1] + 2) * 80 + 50,
  };
}

export function TopologyFallback2D() {
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);

  const expandedCluster = clusters.find((c) => c.id === expandedClusterId) ?? null;

  const handleClusterClick = (id: string) => {
    setExpandedClusterId((prev) => (prev === id ? null : id));
  };

  // Pre-compute positions for connection line lookup
  const positionMap = new Map(
    clusters.map((c) => [c.id, toSvg(c.position)])
  );

  // Collect unique connection pairs to avoid duplicate lines
  const drawnPairs = new Set<string>();
  const connectionLines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];

  for (const cluster of clusters) {
    const from = positionMap.get(cluster.id)!;
    for (const targetId of cluster.connections) {
      const pairKey = [cluster.id, targetId].sort().join('-');
      if (drawnPairs.has(pairKey)) continue;
      drawnPairs.add(pairKey);

      const to = positionMap.get(targetId);
      if (to) {
        connectionLines.push({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, key: pairKey });
      }
    }
  }

  return (
    <div>
      <svg
        viewBox="0 0 500 400"
        className="w-full"
        role="img"
        aria-label="AWS infrastructure topology diagram"
      >
        {/* Connection lines */}
        {connectionLines.map((line) => (
          <line
            key={line.key}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(197,165,114,0.2)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}

        {/* Cluster nodes */}
        {clusters.map((cluster) => {
          const { cx, cy } = positionMap.get(cluster.id)!;
          return (
            <FallbackCluster
              key={cluster.id}
              cluster={cluster}
              isExpanded={expandedClusterId === cluster.id}
              onClick={() => handleClusterClick(cluster.id)}
              cx={cx}
              cy={cy}
            />
          );
        })}
      </svg>

      {/* Detail panel below SVG */}
      <FallbackDetail
        cluster={expandedCluster}
        allClusters={clusters}
        onClose={() => setExpandedClusterId(null)}
      />
    </div>
  );
}
