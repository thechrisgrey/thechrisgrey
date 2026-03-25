import { useState, useMemo, useRef } from 'react';
import { typography } from '../../utils/typography';
import { checkWebGLSupport } from '../../utils/checkWebGL';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { clusters } from '../../data/infrastructureTopology';
import ErrorBoundary from '../ErrorBoundary';
import { TopologyScene } from './TopologyScene';
import type { TopologyControlHandle } from './TopologyScene';
import { TopologyFallback2D } from './TopologyFallback2D';
import { TopologyControls } from './TopologyControls';

/**
 * Map a cluster's 3D position to approximate 2D percentages for the
 * keyboard-accessible overlay buttons.
 *
 * X range in cluster data: roughly -3 to 3 → mapped over an 8-unit span centered at 0.
 * Y range: roughly -1.5 to 1.5 → mapped over a 4-unit span centered at 0.
 * Y is inverted (higher Y in 3D = closer to top in CSS).
 */
function projectTo2D(position: [number, number, number]) {
  const left = ((position[0] + 4) / 8) * 100 + '%';
  const top = ((2 - position[1]) / 4) * 100 + '%';
  return { left, top };
}

export function InfraTopology() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const webglOk = checkWebGLSupport();
  const use3D = isDesktop && webglOk;

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const controlRef = useRef<TopologyControlHandle | null>(null);

  const overlayButtons = useMemo(
    () =>
      clusters.map((cluster) => ({
        id: cluster.id,
        label: cluster.label,
        ...projectTo2D(cluster.position),
      })),
    [],
  );

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2
          style={typography.sectionHeader}
          className="text-white mb-4 text-center"
        >
          The Stack
        </h2>
        <p
          style={typography.subtitle}
          className="text-altivum-silver text-center mb-20"
        >
          Infrastructure powering thechrisgrey.com
        </p>
      </div>

      {use3D ? (
        <ErrorBoundary fallback={<TopologyFallback2D />}>
          <div className="relative">
            <TopologyScene
              selectedClusterId={selectedClusterId}
              onSelectCluster={setSelectedClusterId}
              controlRef={controlRef}
            />

            {/* Manual controls */}
            <TopologyControls controlRef={controlRef} />

            {/* Keyboard-accessible overlay: real HTML buttons over the Canvas */}
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              aria-hidden="true"
            >
              {overlayButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  aria-label={`${btn.label} cluster`}
                  aria-hidden="false"
                  className="pointer-events-auto w-8 h-8 rounded-full bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-altivum-gold focus-visible:ring-offset-2 focus-visible:ring-offset-altivum-dark"
                  style={{
                    position: 'absolute',
                    left: btn.left,
                    top: btn.top,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={() =>
                    setSelectedClusterId((prev) =>
                      prev === btn.id ? null : btn.id,
                    )
                  }
                />
              ))}
            </div>
          </div>
        </ErrorBoundary>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TopologyFallback2D />
        </div>
      )}
    </section>
  );
}
