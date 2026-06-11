import {
  useRef,
  useEffect,
  useState,
  useCallback,
  Suspense,
  type RefObject,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type Lenis from 'lenis';
import { useEditorialCanvas } from './EditorialCanvas';
import { useLenisContext } from '../../hooks/useLenis';
import { surfaceVertexShader, surfaceFragmentShader, coverScale } from './surfaceShader';

// Vite glob-imports every graded asset so stems resolve to hashed URLs.
const ASSETS = import.meta.glob('../../assets/editorial/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

interface AssetEntry {
  width: number;
  url: string;
}

// Widths are discovered from the actual graded files, not a fixed list —
// undersized sources (the 1200px portrait) emit native-width sets that a
// hardcoded 640/1280/1920 builder would miss.
function assetsFor(stem: string, ext: string): AssetEntry[] {
  const re = new RegExp(`/${stem}-(\\d+)\\.${ext}$`);
  return Object.entries(ASSETS)
    .flatMap(([assetPath, url]) => {
      const m = assetPath.match(re);
      return m ? [{ width: Number(m[1]), url }] : [];
    })
    .sort((a, b) => a.width - b.width);
}

function srcSet(stem: string, ext: string): string {
  return assetsFor(stem, ext)
    .map((e) => `${e.url} ${e.width}w`)
    .join(', ');
}

function largestUpTo1280(entries: AssetEntry[]): string | undefined {
  if (entries.length === 0) return undefined;
  const upTo1280 = entries.filter((e) => e.width <= 1280);
  return (upTo1280.length > 0 ? upTo1280[upTo1280.length - 1] : entries[0]).url;
}

/** Largest jpg at or below 1280 — the <img> src fallback. */
function primaryJpg(stem: string): string | undefined {
  return largestUpTo1280(assetsFor(stem, 'jpg'));
}

/** Largest webp at or below 1280 for the WebGL texture (~3x smaller than the
 *  jpg set across the page); falls back to jpgs if no webp was graded. */
function primaryTexture(stem: string): string | undefined {
  const webps = assetsFor(stem, 'webp');
  return largestUpTo1280(webps.length > 0 ? webps : assetsFor(stem, 'jpg'));
}

// DEV diagnostics: warn once per unknown stem, not once per render.
const warnedStems = new Set<string>();

interface SurfaceDriver {
  pointer: { x: number; y: number }; // rect-local UV; -1,-1 when inactive
  hover: number;
  scroll: number;
}

interface SurfaceSceneProps {
  textureUrl: string;
  driver: RefObject<SurfaceDriver>;
  /** Fired post-suspense — the texture is decoded, safe to fade the img. */
  onReady: () => void;
  /** Fired on unmount — restores the img before the surface disappears. */
  onUnready: () => void;
}

function SurfaceScene({ textureUrl, driver, onReady, onUnready }: SurfaceSceneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);
  // The texture must stay at its default (NoColorSpace): this ShaderMaterial
  // writes raw texels with no encode/tonemap chunks, so sRGB bytes pass
  // through pixel-faithful and match the DOM img. Setting SRGBColorSpace
  // would decode without a matching re-encode and darken everything.
  const texture = useTexture(textureUrl);

  // useTexture suspends, so mount = texture loaded: the earliest moment the
  // DOM img can fade without flashing the umber backdrop underneath.
  useEffect(() => {
    onReady();
    invalidate();
    return () => onUnready();
  }, [onReady, onUnready, invalidate]);

  useFrame(({ camera }) => {
    const mat = materialRef.current;
    const mesh = meshRef.current;
    const d = driver.current;
    if (!mat || !mesh || !d) return;

    // drei syncs camera.aspect to the View rect every frame; size the plane
    // to fill it exactly (fov 90 at z=1 spans a 2-unit-tall frustum slice).
    const rectAspect = (camera as THREE.PerspectiveCamera).aspect;
    mesh.scale.set(2 * rectAspect, 2, 1);

    // Cover-fit crop: the fraction of the texture the rect shows per axis.
    const image = texture.image as { width?: number; height?: number } | undefined;
    const imageAspect =
      image && image.width && image.height ? image.width / image.height : rectAspect;
    const [scaleU, scaleV] = coverScale(rectAspect, imageAspect);
    (mat.uniforms.uUvScale.value as THREE.Vector2).set(scaleU, scaleV);

    mat.uniforms.uPointer.value.set(d.pointer.x, d.pointer.y);
    mat.uniforms.uHover.value = THREE.MathUtils.lerp(mat.uniforms.uHover.value, d.hover, 0.08);
    mat.uniforms.uScroll.value = THREE.MathUtils.lerp(mat.uniforms.uScroll.value, d.scroll, 0.08);

    // Scroll energy decays here, frame-driven — the convergence gate below
    // guarantees frames keep coming while any energy remains.
    d.scroll *= 0.92;
    if (d.scroll < 0.001) d.scroll = 0;

    // Convergence gate: render only until the uniforms settle on their
    // targets. A parked cursor stops costing frames; per-move frames come
    // from the context invalidate in the pointer handlers.
    const settled =
      Math.abs(mat.uniforms.uHover.value - d.hover) < 0.004 &&
      mat.uniforms.uScroll.value < 0.004 &&
      d.scroll < 0.004;
    if (!settled) invalidate();
  });

  return (
    <mesh ref={meshRef} scale={[2, 2, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={surfaceVertexShader}
        fragmentShader={surfaceFragmentShader}
        uniforms={{
          uMap: { value: texture },
          uPointer: { value: new THREE.Vector2(-1, -1) },
          uHover: { value: 0 },
          uScroll: { value: 0 },
          uUvScale: { value: new THREE.Vector2(1, 1) },
        }}
      />
    </mesh>
  );
}

interface EditorialImageProps {
  /** Graded asset stem in src/assets/editorial, e.g. "venture-altivum". */
  stem: string;
  alt: string;
  /** CSS aspect-ratio value, reserved up front (CLS rule). */
  aspect: string;
  className?: string;
  sizes?: string;
  /** Set for above-the-fold placements; defaults to lazy. */
  priority?: boolean;
  /**
   * When false, skip the WebGL View entirely and render only the picture/img.
   * Use in contexts where the canvas stacking context would paint over panel
   * text (e.g. GSAP-translated tracks that form a z-auto stacking context
   * below the fixed z-20 canvas).
   * @default true
   */
  surface?: boolean;
}

/**
 * Graded editorial image. Always a real <picture>/<img> for SEO/layout/
 * fallback; when the shared canvas is ready and the slot nears the viewport,
 * a displacement-shader surface (cursor ripple + scroll wave) renders over
 * the same rect and the img fades once the texture has actually decoded.
 */
const EditorialImage = ({
  stem,
  alt,
  aspect,
  className = '',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
  surface = true,
}: EditorialImageProps) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const driver = useRef<SurfaceDriver>({ pointer: { x: -1, y: -1 }, hover: 0, scroll: 0 });
  const { ready, invalidate: invalidateCanvas } = useEditorialCanvas();
  const { lenis } = useLenisContext();
  const [inView, setInView] = useState(false);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const textureUrl = primaryTexture(stem);

  if (import.meta.env.DEV && !warnedStems.has(stem) && assetsFor(stem, 'jpg').length === 0) {
    warnedStems.add(stem);
    console.warn(`EditorialImage: no graded assets for stem "${stem}"`);
  }

  const handleSurfaceReady = useCallback(() => setSurfaceReady(true), []);
  const handleSurfaceUnready = useCallback(() => setSurfaceReady(false), []);

  // Defer the View (and its texture fetch) until the slot approaches the
  // viewport; sticky after the first hit so the surface never re-suspends.
  // Skipped entirely when surface={false} — no View will ever mount.
  useEffect(() => {
    if (!surface) return;
    const el = slotRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [surface]);

  // Cursor tracking on the slot (fine pointers only — touch gets no ripple).
  useEffect(() => {
    if (!surface || !ready) return;
    const el = slotRef.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;

    // Rect cached on entry (pointermove fires at device rate) and dropped on
    // window scroll: Lenis moves content under a stationary cursor with no
    // boundary events, so the next move after a scroll must re-read it.
    let rect: DOMRect | null = null;
    const onEnter = () => {
      rect = el.getBoundingClientRect();
    };
    const onScrollClearRect = () => {
      rect = null;
    };
    const onMove = (e: PointerEvent) => {
      if (!rect) rect = el.getBoundingClientRect();
      driver.current.pointer.x = (e.clientX - rect.left) / rect.width;
      driver.current.pointer.y = 1 - (e.clientY - rect.top) / rect.height;
      driver.current.hover = 1;
      // frameloop="demand": each move must request a frame, or a parked page
      // (no scroll events) never animates the ripple at all.
      invalidateCanvas();
    };
    const onLeave = () => {
      rect = null;
      driver.current.hover = 0;
      driver.current.pointer.x = -1;
      driver.current.pointer.y = -1;
      invalidateCanvas();
    };
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScrollClearRect, { passive: true });
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScrollClearRect);
    };
  }, [surface, ready, invalidateCanvas]);

  // Scroll-velocity energy from Lenis (same normalization as the old
  // HeroCanvas). Decay is frame-driven inside SurfaceScene's useFrame.
  useEffect(() => {
    if (!surface || !ready || !lenis) return;
    const onScroll = (instance: Lenis) => {
      const v = Math.min(Math.abs(instance.velocity) / 30, 1);
      driver.current.scroll = Math.max(driver.current.scroll, v);
    };
    lenis.on('scroll', onScroll);
    return () => {
      lenis.off('scroll', onScroll);
    };
  }, [surface, ready, lenis]);

  const surfaceLive = surface && ready && inView && Boolean(textureUrl);

  return (
    <div
      ref={slotRef}
      data-editorial-image
      className={`relative overflow-hidden bg-altivum-umber ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <picture>
        <source type="image/avif" srcSet={srcSet(stem, 'avif')} sizes={sizes} />
        <source type="image/webp" srcSet={srcSet(stem, 'webp')} sizes={sizes} />
        <img
          src={primaryJpg(stem)}
          srcSet={srcSet(stem, 'jpg')}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            surfaceReady ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </picture>
      {surfaceLive && textureUrl && (
        /* View-as-element per the EditorialCanvas consumer contract; its own
           Suspense so a loading texture never blanks the other views. */
        <View className="pointer-events-none absolute inset-0">
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 0, 1]} fov={90} />
            <SurfaceScene
              textureUrl={textureUrl}
              driver={driver}
              onReady={handleSurfaceReady}
              onUnready={handleSurfaceUnready}
            />
          </Suspense>
        </View>
      )}
    </div>
  );
};

export default EditorialImage;
