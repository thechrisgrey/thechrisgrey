import { useRef, useEffect, Suspense, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type Lenis from 'lenis';
import { useEditorialCanvas } from './EditorialCanvas';
import { useLenisContext } from '../../hooks/useLenis';
import { surfaceVertexShader, surfaceFragmentShader } from './surfaceShader';

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

/** Largest jpg at or below 1280 — the WebGL texture and the <img> src. */
function primaryJpg(stem: string): string | undefined {
  const jpgs = assetsFor(stem, 'jpg');
  if (jpgs.length === 0) return undefined;
  const upTo1280 = jpgs.filter((e) => e.width <= 1280);
  return (upTo1280.length > 0 ? upTo1280[upTo1280.length - 1] : jpgs[0]).url;
}

interface SurfaceDriver {
  pointer: { x: number; y: number }; // image-local UV; -1,-1 when inactive
  hover: number;
  scroll: number;
}

interface SurfaceSceneProps {
  textureUrl: string;
  driver: RefObject<SurfaceDriver>;
}

function SurfaceScene({ textureUrl, driver }: SurfaceSceneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);
  const texture = useTexture(textureUrl);

  useFrame(() => {
    const mat = materialRef.current;
    const d = driver.current;
    if (!mat || !d) return;
    mat.uniforms.uPointer.value.set(d.pointer.x, d.pointer.y);
    mat.uniforms.uHover.value = THREE.MathUtils.lerp(mat.uniforms.uHover.value, d.hover, 0.08);
    mat.uniforms.uScroll.value = THREE.MathUtils.lerp(mat.uniforms.uScroll.value, d.scroll, 0.08);
    // Keep invalidating only while there is energy in the system.
    if (mat.uniforms.uHover.value > 0.004 || mat.uniforms.uScroll.value > 0.004 || d.hover > 0) {
      invalidate();
    }
  });

  return (
    <mesh scale={[2, 2, 1]}>
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
}

/**
 * Graded editorial image. Always a real <picture>/<img> for SEO/layout/
 * fallback; when the shared canvas is ready, a displacement-shader surface
 * (cursor ripple + scroll wave) renders over the same rect and the img fades.
 */
const EditorialImage = ({
  stem,
  alt,
  aspect,
  className = '',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
}: EditorialImageProps) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const driver = useRef<SurfaceDriver>({ pointer: { x: -1, y: -1 }, hover: 0, scroll: 0 });
  const { ready } = useEditorialCanvas();
  const { lenis } = useLenisContext();
  const textureUrl = primaryJpg(stem);

  // Cursor tracking on the slot (fine pointers only — touch gets no ripple).
  useEffect(() => {
    if (!ready) return;
    const el = slotRef.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      driver.current.pointer.x = (e.clientX - rect.left) / rect.width;
      driver.current.pointer.y = 1 - (e.clientY - rect.top) / rect.height;
      driver.current.hover = 1;
    };
    const onLeave = () => {
      driver.current.hover = 0;
      driver.current.pointer.x = -1;
      driver.current.pointer.y = -1;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ready]);

  // Scroll-velocity energy from Lenis (same normalization as the old HeroCanvas).
  useEffect(() => {
    if (!ready || !lenis) return;
    const onScroll = (instance: Lenis) => {
      const v = Math.min(Math.abs(instance.velocity) / 30, 1);
      driver.current.scroll = Math.max(driver.current.scroll, v);
    };
    lenis.on('scroll', onScroll);
    let raf = 0;
    const decay = () => {
      driver.current.scroll *= 0.92;
      if (driver.current.scroll < 0.001) driver.current.scroll = 0;
      raf = requestAnimationFrame(decay);
    };
    raf = requestAnimationFrame(decay);
    return () => {
      lenis.off('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ready, lenis]);

  const surfaceLive = ready && Boolean(textureUrl);

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
          decoding="async"
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            surfaceLive ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </picture>
      {surfaceLive && textureUrl && (
        /* View-as-element per the EditorialCanvas consumer contract; its own
           Suspense so a loading texture never blanks the other views. */
        <View className="pointer-events-none absolute inset-0">
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 0, 1]} fov={90} />
            <SurfaceScene textureUrl={textureUrl} driver={driver} />
          </Suspense>
        </View>
      )}
    </div>
  );
};

export default EditorialImage;
