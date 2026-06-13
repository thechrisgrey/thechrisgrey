import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element and focus the first focusable element
  useEffect(() => {
    if (isActive) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;

      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        if (containerRef.current) {
          const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          }
        }
      }, 10);

      return () => clearTimeout(timer);
    } else {
      // Return focus to previously focused element
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
        previouslyFocusedRef.current = null;
      }
    }
  }, [isActive]);

  // Callback-ref form for consumers that need to wire multiple refs to the
  // same DOM element (e.g. FallbackDetail tracks its own panelRef alongside
  // the focus-trap container). Use this in a JSX `ref={(el) => { ... }}`
  // callback instead of mutating `containerRef.current` directly — the
  // react-hooks/immutability rule treats hook-returned refs as owned by the
  // hook, and writing to `.current` from the consumer trips it.
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  // Handle Tab key to trap focus
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: go backwards
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: go forwards
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  return { containerRef, setContainerRef, handleKeyDown };
}
