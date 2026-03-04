import { useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageContext, type PageContext } from '../utils/pageContext';

const JOURNEY_KEY = 'phantom-journey';
const MAX_JOURNEY = 20;

function getStoredJourney(): string[] {
  try {
    const stored = sessionStorage.getItem(JOURNEY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeJourney(pages: string[]): void {
  try {
    sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(pages));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export function usePageContext(): PageContext {
  const { pathname } = useLocation();

  // Update the journey on every pathname change
  useEffect(() => {
    const current = getStoredJourney();
    // Only add if it's not already the last entry (avoid duplicates from re-renders)
    if (current[current.length - 1] !== pathname) {
      const updated = [...current, pathname].slice(-MAX_JOURNEY);
      storeJourney(updated);
    }
  }, [pathname]);

  const pageContext = useMemo(() => {
    const visitedPages = getStoredJourney();
    // Ensure current page is included even if the effect hasn't fired yet
    if (visitedPages[visitedPages.length - 1] !== pathname) {
      visitedPages.push(pathname);
    }
    return getPageContext(pathname, visitedPages);
  }, [pathname]);

  return pageContext;
}
