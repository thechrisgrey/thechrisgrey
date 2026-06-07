import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type Lenis from 'lenis';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useLenisContext } from '../../hooks/useLenis';
import { heroVertexShader, heroFragmentShader } from './heroShader';

// Altivum palette as THREE colors (matches tailwind.config.js).
const COLOR_DARK = new THREE.Color('#0A0F1C');
const COLOR_NAVY = new THREE.Color('#1A2332');
const COLOR_GOLD = new THREE.Color('#C5A572');

/**
 * Shared mutable target for pointer + scroll, read by the field every frame.
 * Pointer is hero-local NDC-ish (-1..1, x and y), decaying to center on leave.
 * scroll is normalized, clamped Lenis velocity in [0, 1].
 */
interface FieldDriver {
  pointer: { x: number; y: number };
  scroll: number;
}

interface SignalFieldProps {
  driver: React.MutableRefObject<FieldDriver>;
  animate: boolean;
}

function SignalField({ driver, animate }: SignalFieldProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size, invalidate } = useThree();

  // Smoothed values so pointer/scroll changes glide rather than snap.
  const smoothedPointer = useRef({ x: 0, y: 0 });
  const smoothedScroll = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uScroll: { value: 0 },
      uAspect: { value: 1 },
      uColorDark: { value: COLOR_DARK.clone() },
      uColorNavy: { value: COLOR_NAVY.clone() },
      uColorGold: { value: COLOR_GOLD.clone() },
    }),
    [],
  );

  // Keep aspect in sync with the canvas size.
  useEffect(() => {
    uniforms.uAspect.value = size.height > 0 ? size.width / size.height : 1;
    invalidate();
  }, [size.width, size.height, uniforms, invalidate]);

  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat) return;

    // Under reduced motion we render exactly one frame: hold time/pointer/scroll
    // at rest so the field is a static, palette-locked gradient.
    if (!animate) {
      mat.uniforms.uTime.value = 8.0; // a pleasant, settled offset
      mat.uniforms.uPointer.value.set(0, 0);
      mat.uniforms.uScroll.value = 0;
      return;
    }

    mat.uniforms.uTime.value = state.clock.elapsedTime;

    // Lerp pointer toward its target (target already decays to 0 on leave).
    const sp = smoothedPointer.current;
    sp.x = THREE.MathUtils.lerp(sp.x, driver.current.pointer.x, 0.05);
    sp.y = THREE.MathUtils.lerp(sp.y, driver.current.pointer.y, 0.05);
    mat.uniforms.uPointer.value.set(sp.x, sp.y);

    // Lerp scroll toward its target; the driver decays scroll to 0 each frame.
    smoothedScroll.current = THREE.MathUtils.lerp(
      smoothedScroll.current,
      driver.current.scroll,
      0.08,
    );
    mat.uniforms.uScroll.value = smoothedScroll.current;
  });

  return (
    <mesh>
      {/* Full-screen triangle-ish quad; the vertex shader ignores camera and
          writes clip-space directly, so a 2x2 plane fills the viewport. */}
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={heroVertexShader}
        fragmentShader={heroFragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

interface HeroCanvasProps {
  /** Ref to the hero <section> so pointer math is relative to the hero only. */
  heroRef: React.RefObject<HTMLElement | null>;
}

const HeroCanvas = ({ heroRef }: HeroCanvasProps) => {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { lenis } = useLenisContext();

  // Mirror AltiMascot: pause the render loop entirely when the tab is hidden.
  const [docVisible, setDocVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  );
  useEffect(() => {
    const onVisibility = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const driver = useRef<FieldDriver>({ pointer: { x: 0, y: 0 }, scroll: 0 });

  // Pointer tracking, scoped to the hero. Disabled under reduced motion.
  useEffect(() => {
    if (reducedMotion) return;
    const el = heroRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // -1..1, y up.
      driver.current.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      driver.current.pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const onLeave = () => {
      // Decay back to center on leave.
      driver.current.pointer.x = 0;
      driver.current.pointer.y = 0;
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [heroRef, reducedMotion]);

  // Scroll velocity from Lenis. If there's no instance (reduced-motion users
  // get none), simply skip scroll reactivity — never crash.
  useEffect(() => {
    if (reducedMotion || !lenis) return;

    let raf = 0;
    // Each Lenis 'scroll' tick passes the Lenis instance; read its velocity,
    // then normalize + clamp it into [0, 1].
    const onScroll = (instance: Lenis) => {
      const v = Math.min(Math.abs(instance.velocity) / 30, 1);
      driver.current.scroll = Math.max(driver.current.scroll, v);
    };
    lenis.on('scroll', onScroll);

    // Decay scroll energy toward 0 between scroll events so the field settles.
    const decay = () => {
      driver.current.scroll *= 0.93;
      if (driver.current.scroll < 0.001) driver.current.scroll = 0;
      raf = requestAnimationFrame(decay);
    };
    raf = requestAnimationFrame(decay);

    return () => {
      lenis.off('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [lenis, reducedMotion]);

  // Match AltiMascot's frameloop policy: never when hidden, demand (one render)
  // under reduced motion, always otherwise.
  const frameloop: 'always' | 'demand' | 'never' = reducedMotion
    ? 'demand'
    : docVisible
      ? 'always'
      : 'never';

  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: false }}
      // Orthographic-free: vertex shader writes clip space directly, so the
      // camera is irrelevant. A default camera is fine.
      style={{ width: '100%', height: '100%' }}
    >
      <SignalField driver={driver} animate={!reducedMotion} />
    </Canvas>
  );
};

export default HeroCanvas;
