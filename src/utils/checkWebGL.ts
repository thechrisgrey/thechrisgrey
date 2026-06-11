let cachedResult: boolean | null = null;

// Probes WebGL2 only: three r163+ removed WebGL1 support, so a WebGL1-only
// context would still throw inside WebGLRenderer. Gating on webgl2 keeps
// unsupported devices on their static fallbacks instead of a guaranteed throw.
export function checkWebGLSupport(): boolean {
  if (cachedResult !== null) return cachedResult;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    cachedResult = gl !== null;
  } catch {
    cachedResult = false;
  }

  return cachedResult!;
}
