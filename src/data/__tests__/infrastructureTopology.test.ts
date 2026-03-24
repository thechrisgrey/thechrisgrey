import { describe, it, expect } from 'vitest';
import { clusters } from '../infrastructureTopology';

describe('infrastructureTopology', () => {
  it('has exactly 6 clusters', () => {
    expect(clusters).toHaveLength(6);
  });

  it('all connections reference valid cluster IDs', () => {
    const clusterIds = new Set(clusters.map((c) => c.id));

    for (const cluster of clusters) {
      for (const connectionId of cluster.connections) {
        expect(clusterIds.has(connectionId)).toBe(true);
      }
    }
  });

  it('every cluster has at least 1 service', () => {
    for (const cluster of clusters) {
      expect(cluster.services.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('cluster positions are unique (no two clusters at same x,y,z)', () => {
    const positionKeys = clusters.map(
      (c) => `${c.position[0]},${c.position[1]},${c.position[2]}`
    );
    const uniqueKeys = new Set(positionKeys);
    expect(uniqueKeys.size).toBe(clusters.length);
  });
});
