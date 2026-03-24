import { useState, useMemo } from 'react';
import { pipelineNodes, pipelineEdges } from '../../data/architectureNodes';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { typography } from '../../utils/typography';
import { PipelineNode } from './PipelineNode';
import { PipelineEdge } from './PipelineEdge';
import { NodeDetailPanel } from './NodeDetailPanel';

const NODE_WIDTH = 100;
const NODE_HEIGHT = 60;

// Spacing between node centers
const DESKTOP_SPACING = 140;
const MOBILE_SPACING = 90;

export function ArchitectureXRay() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [nodeStates, setNodeStates] = useState<Record<string, 'dim' | 'active' | 'warning'>>(() => {
    const initial: Record<string, 'dim' | 'active' | 'warning'> = {};
    for (const node of pipelineNodes) {
      initial[node.id] = 'dim';
    }
    return initial;
  });

  const nodeCount = pipelineNodes.length;

  // Calculate positions and viewBox
  const { positions, viewBox } = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};

    if (isDesktop) {
      // Horizontal layout
      const totalWidth = nodeCount * DESKTOP_SPACING;
      for (let i = 0; i < nodeCount; i++) {
        pos[pipelineNodes[i].id] = {
          x: i * DESKTOP_SPACING + DESKTOP_SPACING / 2,
          y: NODE_HEIGHT / 2 + 10,
        };
      }
      return {
        positions: pos,
        viewBox: `0 0 ${totalWidth} ${NODE_HEIGHT + 20}`,
      };
    } else {
      // Vertical layout
      const totalHeight = nodeCount * MOBILE_SPACING;
      for (let i = 0; i < nodeCount; i++) {
        pos[pipelineNodes[i].id] = {
          x: NODE_WIDTH / 2 + 10,
          y: i * MOBILE_SPACING + MOBILE_SPACING / 2,
        };
      }
      return {
        positions: pos,
        viewBox: `0 0 ${NODE_WIDTH + 20} ${totalHeight}`,
      };
    }
  }, [isDesktop, nodeCount]);

  function handleNodeClick(nodeId: string) {
    if (expandedNodeId === nodeId) {
      // Collapse
      setExpandedNodeId(null);
      setNodeStates((prev) => {
        const next = { ...prev };
        next[nodeId] = 'dim';
        return next;
      });
    } else {
      // Expand this node, dim the previous
      setExpandedNodeId(nodeId);
      setNodeStates((prev) => {
        const next: Record<string, 'dim' | 'active' | 'warning'> = {};
        for (const key of Object.keys(prev)) {
          next[key] = 'dim';
        }
        next[nodeId] = 'active';
        return next;
      });
    }
  }

  const expandedNode = pipelineNodes.find((n) => n.id === expandedNodeId) ?? null;

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-white mb-4" style={typography.sectionHeader}>
            The Architecture
          </h2>
          <p className="text-altivum-silver" style={typography.subtitle}>
            How the Alti chat pipeline works
          </p>
        </div>

        {/* SVG Pipeline */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={viewBox}
            className="w-full"
            style={{ minWidth: isDesktop ? nodeCount * DESKTOP_SPACING : undefined }}
            role="img"
            aria-label="Architecture pipeline diagram showing the Alti chat data flow"
          >
            {/* Edges first (behind nodes) */}
            {pipelineEdges.map((edge) => {
              const fromPos = positions[edge.from];
              const toPos = positions[edge.to];
              if (!fromPos || !toPos) return null;

              // Offset edge endpoints to node borders
              let x1: number, y1: number, x2: number, y2: number;
              if (isDesktop) {
                // Horizontal: edges go from right side of 'from' to left side of 'to'
                x1 = fromPos.x + NODE_WIDTH / 2;
                y1 = fromPos.y;
                x2 = toPos.x - NODE_WIDTH / 2;
                y2 = toPos.y;
              } else {
                // Vertical: edges go from bottom of 'from' to top of 'to'
                x1 = fromPos.x;
                y1 = fromPos.y + NODE_HEIGHT / 2;
                x2 = toPos.x;
                y2 = toPos.y - NODE_HEIGHT / 2;
              }

              const isActive =
                nodeStates[edge.from] === 'active' || nodeStates[edge.to] === 'active';

              return (
                <PipelineEdge
                  key={`${edge.from}-${edge.to}`}
                  edge={edge}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  state={isActive ? 'active' : 'dim'}
                />
              );
            })}

            {/* Nodes */}
            {pipelineNodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;

              return (
                <PipelineNode
                  key={node.id}
                  node={node}
                  state={nodeStates[node.id]}
                  isExpanded={expandedNodeId === node.id}
                  onClick={() => handleNodeClick(node.id)}
                  x={pos.x}
                  y={pos.y}
                />
              );
            })}
          </svg>
        </div>

        {/* Detail panel below SVG */}
        <NodeDetailPanel
          node={expandedNode}
          onClose={() => {
            setExpandedNodeId(null);
            setNodeStates((prev) => {
              const next: Record<string, 'dim' | 'active' | 'warning'> = {};
              for (const key of Object.keys(prev)) {
                next[key] = 'dim';
              }
              return next;
            });
          }}
        />
      </div>
    </section>
  );
}
