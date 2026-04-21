import type { PipelineNodeData } from '../../data/architectureNodes';

type NodeState = 'dim' | 'active' | 'warning';

interface PipelineNodeProps {
  node: PipelineNodeData;
  state: NodeState;
  isExpanded: boolean;
  onClick: () => void;
  x: number;
  y: number;
}

const NODE_WIDTH = 100;
const NODE_HEIGHT = 60;
const CORNER_RADIUS = 8;

const stateStyles: Record<NodeState, { stroke: string; strokeOpacity: number; fill: string }> = {
  dim: {
    stroke: '#4A5A73',
    strokeOpacity: 0.5,
    fill: 'rgba(26,35,50,0.2)',
  },
  active: {
    stroke: '#C5A572',
    strokeOpacity: 1,
    fill: 'rgba(197,165,114,0.1)',
  },
  warning: {
    stroke: '#F59E0B',
    strokeOpacity: 1,
    fill: 'rgba(245,158,11,0.1)',
  },
};

export function PipelineNode({ node, state, isExpanded, onClick, x, y }: PipelineNodeProps) {
  const style = stateStyles[state];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <g
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
      aria-label={node.label}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      <rect
        x={x - NODE_WIDTH / 2}
        y={y - NODE_HEIGHT / 2}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={CORNER_RADIUS}
        ry={CORNER_RADIUS}
        stroke={style.stroke}
        strokeOpacity={style.strokeOpacity}
        strokeWidth={1.5}
        fill={style.fill}
      />
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#FFFFFF"
        fontSize={13}
        fontFamily='"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif'
        fontWeight={300}
      >
        {node.label}
      </text>
      <text
        x={x}
        y={y + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#9BA6B8"
        fontSize={10}
        fontFamily='"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif'
        fontWeight={200}
      >
        {node.sublabel}
      </text>
    </g>
  );
}
