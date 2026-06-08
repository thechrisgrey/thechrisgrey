import { ReactNode, Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface SafeCanvasProps {
  /** The 3D Canvas tree (R3F <Canvas>...) to render. */
  children: ReactNode;
  /**
   * Shown when the canvas tree throws on mount (GLB parse / R3F init /
   * useGLTF Suspense rejection) OR while it suspends. Defaults to null —
   * callers that have a static visual behind the canvas can omit it; callers
   * with no static fallback (e.g. the chat mascot) MUST pass one.
   *
   * NOTE: an error boundary cannot catch errors thrown from the rAF loop
   * (useFrame) or from webglcontextlost DOM events — only render/lifecycle/
   * Suspense errors. Gate the mount with checkWebGLSupport() to avoid those.
   */
  fallback?: ReactNode;
}

/**
 * Reusable containment wrapper for WebGL canvases: Suspense (for lazy GLB /
 * useGLTF) + ErrorBoundary (for mount-time throws), both resolving to the same
 * fallback so a failed 3D mount degrades gracefully instead of unmounting the
 * surrounding tree.
 */
const SafeCanvas = ({ children, fallback = null }: SafeCanvasProps) => (
  <ErrorBoundary fallback={fallback} showHomeButton={false}>
    <Suspense fallback={fallback}>{children}</Suspense>
  </ErrorBoundary>
);

export default SafeCanvas;
