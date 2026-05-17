import { useCallback } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router-dom';

function supportsViewTransitions(): boolean {
  return 'startViewTransition' in document;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useViewTransitionNavigate() {
  const navigate = useNavigate();

  const transitionNavigate = useCallback((to: string, options?: NavigateOptions) => {
    if (!supportsViewTransitions() || prefersReducedMotion()) {
      navigate(to, options);
      return;
    }

    document.startViewTransition(() => {
      navigate(to, options);
    });
  }, [navigate]);

  return transitionNavigate;
}
