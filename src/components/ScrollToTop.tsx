import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLenisContext } from '../hooks/useLenis';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const { lenis } = useLenisContext();

  useLayoutEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname, lenis]);

  return null;
};

export default ScrollToTop;
