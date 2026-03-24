import type { ClusterData } from '../../data/infrastructureTopology';

interface FallbackClusterProps {
  cluster: ClusterData;
  isExpanded: boolean;
  onClick: () => void;
  cx: number;
  cy: number;
}

export function FallbackCluster({ cluster, isExpanded, onClick, cx, cy }: FallbackClusterProps) {
  const radius = cluster.size * 40;
  const serviceCount = cluster.services.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`${cluster.label} cluster with ${serviceCount} services`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer' }}
    >
      {/* Cluster circle */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={isExpanded ? 'rgba(197,165,114,0.1)' : 'rgba(26,35,50,0.3)'}
        stroke={isExpanded ? '#C5A572' : 'rgba(197,165,114,0.3)'}
        strokeWidth={1.5}
      />

      {/* Label text */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={12}
        fontFamily='"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif'
        fontWeight={200}
        letterSpacing="0.02em"
      >
        {cluster.label}
      </text>

      {/* Service count badge */}
      <circle
        cx={cx}
        cy={cy + radius + 12}
        r={8}
        fill="rgba(26,35,50,0.6)"
        stroke="rgba(197,165,114,0.2)"
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy + radius + 12}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#9BA6B8"
        fontSize={10}
        fontFamily='"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif'
        fontWeight={200}
      >
        {serviceCount}
      </text>
    </g>
  );
}
