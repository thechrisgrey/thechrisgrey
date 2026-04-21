import type { PipelineEdgeData } from '../../data/architectureNodes';

type EdgeState = 'dim' | 'active';

interface PipelineEdgeProps {
  edge: PipelineEdgeData;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: EdgeState;
}

export function PipelineEdge({ edge, x1, y1, x2, y2, state }: PipelineEdgeProps) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const isDim = state === 'dim';

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isDim ? '#4A5A73' : '#C5A572'}
        strokeWidth={1}
        strokeDasharray={isDim ? '4 4' : undefined}
        strokeOpacity={isDim ? 0.5 : 1}
      />
      {!isDim && (
        <text
          x={midX}
          y={midY - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#9BA6B8"
          fontSize={11}
          fontFamily='"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif'
          fontWeight={200}
        >
          {edge.estimatedLatencyMs}
        </text>
      )}
    </g>
  );
}
