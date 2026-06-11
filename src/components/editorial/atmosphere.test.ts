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

  it('stays within bounds across 10,000 steps', () => {
    let y = 0;
    for (let i = 0; i < 10_000; i++) {
      y = advanceParticleY(y, 0.05);
      expect(y).toBeGreaterThanOrEqual(-PARTICLE_BOUNDS.y - 0.001);
      expect(y).toBeLessThanOrEqual(PARTICLE_BOUNDS.y + 0.001);
    }
  });
});
