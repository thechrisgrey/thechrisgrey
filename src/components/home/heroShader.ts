// GLSL for the hero "signal field" — a slow, low-amplitude domain-warped
// gradient rendered on a single full-screen plane (the Stripe-gradient school:
// a 2D plane whose fragment shader reads as depth, NOT a 3D scene).
//
// Palette-locked to the Altivum system: the field interpolates dark -> navy and
// only lets a heavily-attenuated gold surface in the brightest crests, so the
// accent reads as a faint ember rather than a gradient. A baked vignette plus a
// bottom-weighted darken guarantee headline/brandmark contrast on top.
//
// Kept deliberately restrained: two octaves of value noise, warped twice, driven
// at a very slow time scale with no high-frequency term — no flicker.

export const heroVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const heroFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uPointer;     // lerped, hero-local, decays to (0,0) at rest
  uniform float uScroll;      // normalized + clamped Lenis velocity, [0, 1]
  uniform float uAspect;      // viewport aspect (w / h)
  uniform vec3  uColorDark;   // #0A0F1C
  uniform vec3  uColorNavy;   // #1A2332
  uniform vec3  uColorGold;   // #C5A572

  // ---- value noise + fbm -------------------------------------------------
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // smootherstep for soft, organic transitions
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // 3 octaves — enough structure to feel alive, cheap enough for mobile.
  float fbm(vec2 p) {
    float total = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      total += valueNoise(p) * amp;
      p *= 2.0;
      amp *= 0.5;
    }
    return total;
  }

  void main() {
    // Aspect-correct the field so the warp doesn't stretch on wide screens.
    vec2 uv = vUv;
    vec2 p = uv;
    p.x *= uAspect;

    // Pointer nudges the warp center by a tiny amount. Scroll velocity adds a
    // small, transient boost to the warp speed so the field "stirs" while
    // scrolling and settles when it stops.
    float speed = 0.012 + uScroll * 0.02;
    float t = uTime * speed;
    vec2 pointer = uPointer * 0.12;

    // --- domain warp (warp the coordinates twice) ---
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0) + t),
      fbm(p + vec2(5.2, 1.3) - t)
    );

    vec2 r = vec2(
      fbm(p + 1.4 * q + vec2(1.7, 9.2) + pointer + 0.10 * t),
      fbm(p + 1.4 * q + vec2(8.3, 2.8) - pointer + 0.08 * t)
    );

    float field = fbm(p + 1.6 * r);

    // Gentle vertical bias: darker toward the bottom for headline contrast.
    field = mix(field, field * 0.82, smoothstep(0.35, 1.0, uv.y));

    // --- palette mix: dark -> navy across the field's mid-range ---
    // Wider, lower-anchored smoothstep so the blue mid-stop actually
    // dominates the canvas (the old (0.30, 0.78) range hit fully-navy so
    // rarely that the field read as solid #0A0F1C on most monitors).
    float navyMix = smoothstep(0.18, 0.60, field);
    vec3 color = mix(uColorDark, uColorNavy, navyMix);

    // Gold only in the brightest crests, heavily attenuated. Scroll velocity
    // lifts the ceiling slightly so the embers brighten as you move.
    float goldCeil = 0.085 + uScroll * 0.045;
    float gold = smoothstep(0.72, 0.95, field) * goldCeil;
    color = mix(color, uColorGold, gold);

    // Radial vignette toward the dark base — keeps edges quiet, center
    // subtly lit. The floor was 0.55 (so edges sat at 55% of the field
    // color); lifted to 0.78 so the navy reads at full strength almost
    // everywhere and the vignette only nudges the very corners darker.
    vec2 vc = uv - 0.5;
    vc.x *= uAspect;
    float vig = smoothstep(1.05, 0.25, length(vc));
    color = mix(uColorDark, color, 0.78 + 0.22 * vig);

    // Faint dithering to defeat banding in the deep navy gradient (no flicker:
    // static per-pixel, not time-varying).
    float dither = (hash(gl_FragCoord.xy) - 0.5) * 0.012;
    color += dither;

    gl_FragColor = vec4(color, 1.0);
  }
`;
