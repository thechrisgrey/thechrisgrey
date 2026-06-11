// Image displacement surface: gentle UV warp driven by cursor proximity
// (desktop hover) and Lenis scroll velocity. Settles to a perfect, unwarped
// image when both inputs are at rest.

export const surfaceVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const surfaceFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uPointer;   // rect-local UV of the cursor, (-1,-1) = inactive
  uniform float uHover;    // 0..1 hover energy
  uniform float uScroll;   // 0..1 normalized scroll velocity
  uniform vec2 uUvScale;   // cover-fit crop: rect-space UV -> texture-space UV
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // Cursor ripple — displacement falls off with distance from the pointer.
    // Stays in rect space: uPointer is normalized against the DOM rect.
    if (uPointer.x >= 0.0) {
      vec2 toPointer = uv - uPointer;
      float dist = length(toPointer);
      float influence = smoothstep(0.45, 0.0, dist) * uHover;
      uv -= normalize(toPointer + 1e-5) * influence * 0.035;
    }

    // Scroll wave — subtle vertical shear proportional to velocity.
    uv.y += sin(uv.x * 6.2831) * uScroll * 0.012;

    // Cover-fit: map rect-space UV into the centered crop of the texture.
    vec2 tuv = (uv - 0.5) * uUvScale + 0.5;
    gl_FragColor = texture2D(uMap, clamp(tuv, 0.0, 1.0));
  }
`;
