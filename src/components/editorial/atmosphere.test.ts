import { describe, it, expect } from 'vitest';
import { advanceParticleY, PARTICLE_BOUNDS } from './AtmosphereView';

describe('advanceParticleY', () => {
  it('drifts particles upward', () => {
    expect(advanceParticleY(0, 0.5)).toBeGreaterThan(0);
  });

  it('wraps to the bottom after passing the top bound', () => {
    const y = advanceParticleY(PARTICLE_BOUNDS.y, 0.5);
    expect(y).toBeLessThanOrEqual(-PARTICLE_BOUNDS.y + 0.1);
  });
});
