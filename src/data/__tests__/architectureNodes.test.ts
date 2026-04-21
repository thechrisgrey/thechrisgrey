import { describe, it, expect } from 'vitest';
import { pipelineNodes, pipelineEdges } from '../architectureNodes';

describe('architectureNodes', () => {
  it('has exactly 7 pipeline nodes', () => {
    expect(pipelineNodes).toHaveLength(7);
  });

  it('has exactly 6 pipeline edges', () => {
    expect(pipelineEdges).toHaveLength(6);
  });

  it('every edge references valid node IDs', () => {
    const nodeIds = new Set(pipelineNodes.map((n) => n.id));

    for (const edge of pipelineEdges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });

  it('every node has non-empty config (at least 1 key)', () => {
    for (const node of pipelineNodes) {
      expect(Object.keys(node.config).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every node has non-empty reasoning', () => {
    for (const node of pipelineNodes) {
      expect(node.reasoning.length).toBeGreaterThan(0);
    }
  });
});
