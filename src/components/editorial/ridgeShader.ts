// Procedural contour-line terrain. Vertex displaces a plane with 4-octave
// value-noise FBM; fragment draws iso-elevation lines and reveals them from
// low to high elevation as uProgress animates 0 -> 1 (the once-on-load
// "draw-in"), after which the scene is fully static.

export const ridgeVertexShader = /* glsl */ `
  uniform float uAmp;
  varying float vH;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vUv = uv;
    // Ridge profile: higher toward the back, fades at the sides.
    float h = fbm(uv * 3.0 + vec2(7.3, 1.7));
    h *= smoothstep(0.0, 0.35, uv.y) * (1.0 - 0.35 * abs(uv.x - 0.5) * 2.0);
    vH = h;
    vec3 displaced = position + normal * h * uAmp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const ridgeFragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform vec3 uColorGold;
  uniform vec3 uColorPorcelain;
  varying float vH;
  varying vec2 vUv;

  void main() {
    // Iso-elevation contour bands.
    float bands = 14.0;
    float f = fract(vH * bands);
    float dist = min(f, 1.0 - f);
    float w = fwidth(vH * bands) * 1.4;
    float line = 1.0 - smoothstep(0.0, w + 0.03, dist);

    // Draw-in: contours appear from low elevation to high as uProgress rises.
    float reveal = smoothstep(vH - 0.06, vH + 0.02, uProgress);

    // Depth fade toward the back edge keeps the horizon airy.
    float fade = mix(1.0, 0.25, smoothstep(0.55, 1.0, vUv.y));

    // Occasional porcelain highlight line for tonal variation.
    float band = floor(vH * bands);
    float isHighlight = step(0.5, fract(band * 0.2)) * 0.0 + step(4.5, mod(band, 5.0));
    vec3 color = mix(uColorGold, uColorPorcelain, isHighlight * 0.35);

    float alpha = line * reveal * fade * 0.85;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;
