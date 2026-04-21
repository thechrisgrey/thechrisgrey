import { Html } from '@react-three/drei';
import type { ClusterData } from '../../data/infrastructureTopology';

interface ClusterDetailProps {
  cluster: ClusterData;
  allClusters: ClusterData[];
  onClose: () => void;
}

const styles = {
  wrapper: {
    pointerEvents: 'none' as const,
  },
  panel: {
    pointerEvents: 'auto' as const,
    background: '#1A2332',
    border: '1px solid rgba(74,90,115,0.3)',
    borderRadius: 8,
    padding: 16,
    width: 280,
    maxHeight: 400,
    fontFamily: '"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif',
    fontWeight: 200,
    letterSpacing: '0.02em',
  },
  header: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    margin: 0,
  },
  subtitle: {
    color: '#9BA6B8',
    fontSize: 11,
    margin: '4px 0 0',
  },
  closeBtn: {
    pointerEvents: 'auto' as const,
    background: 'none',
    border: 'none',
    color: '#9BA6B8',
    cursor: 'pointer',
    padding: 2,
    fontSize: 16,
    lineHeight: 1,
  },
  serviceGrid: {
    pointerEvents: 'auto' as const,
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 12,
    maxHeight: 260,
    overflowY: 'auto' as const,
  },
  serviceName: {
    color: '#FFFFFF',
    fontSize: 12,
    margin: 0,
  },
  serviceType: {
    color: '#C5A572',
    fontSize: 10,
    margin: '2px 0 0',
  },
  serviceRegion: {
    color: 'rgba(155,166,184,0.5)',
    fontSize: 10,
    margin: '2px 0 0',
  },
  serviceDesc: {
    color: '#9BA6B8',
    fontSize: 10,
    margin: '2px 0 0',
    lineHeight: 1.4,
  },
  divider: {
    height: 1,
    background: 'rgba(74,90,115,0.2)',
    border: 'none',
    margin: '0 0 10px',
  },
  connectionsLabel: {
    color: '#9BA6B8',
    fontSize: 11,
    margin: 0,
  },
  connectionName: {
    color: '#C5A572',
  },
} as const;

export function ClusterDetail({ cluster, allClusters, onClose }: ClusterDetailProps) {
  const connectedClusterNames = cluster.connections
    .map((id) => allClusters.find((c) => c.id === id))
    .filter((c): c is ClusterData => c !== undefined)
    .map((c) => c.label);

  return (
    <Html
      position={[
        cluster.position[0] + cluster.size + 0.5,
        cluster.position[1] + 0.3,
        cluster.position[2],
      ]}
      style={styles.wrapper}
    >
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <p style={styles.title}>{cluster.label}</p>
            <p style={styles.subtitle}>
              {cluster.services.length} service{cluster.services.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close detail panel"
          >
            x
          </button>
        </div>

        {/* Services grid */}
        <div style={styles.serviceGrid}>
          {cluster.services.map((service) => (
            <div key={service.name}>
              <p style={styles.serviceName}>{service.name}</p>
              <p style={styles.serviceType}>{service.type}</p>
              <p style={styles.serviceRegion}>{service.region}</p>
              <p style={styles.serviceDesc}>{service.description}</p>
            </div>
          ))}
        </div>

        {/* Connections */}
        {connectedClusterNames.length > 0 && (
          <>
            <hr style={styles.divider} />
            <p style={styles.connectionsLabel}>
              Connected to:{' '}
              {connectedClusterNames.map((name, i) => (
                <span key={name}>
                  <span style={styles.connectionName}>{name}</span>
                  {i < connectedClusterNames.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          </>
        )}
      </div>
    </Html>
  );
}
