import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConsentBanner from './ConsentBanner';
import { getConsent, setConsent, clearConsent } from '../utils/consent';

// Control PostHog config + capture the enable call without loading posthog-js.
const enablePostHog = vi.fn();
let configured = true;
vi.mock('../utils/posthog', () => ({
  isPostHogConfigured: () => configured,
  enablePostHog: () => enablePostHog(),
}));

const renderBanner = () =>
  render(
    <MemoryRouter>
      <ConsentBanner />
    </MemoryRouter>,
  );

const banner = () => screen.queryByRole('region', { name: /analytics consent/i });

// jsdom here provides only a partial localStorage; install a complete fresh mock
// per test so consent reads/writes are deterministic.
function installMockLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    installMockLocalStorage();
    clearConsent();
    enablePostHog.mockClear();
    configured = true;
  });

  it('shows when PostHog is configured and no choice has been made', () => {
    renderBanner();
    expect(banner()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
  });

  it('stays hidden when PostHog is not configured', () => {
    configured = false;
    renderBanner();
    expect(banner()).not.toBeInTheDocument();
  });

  it('stays hidden once a choice has already been made', () => {
    setConsent('denied');
    renderBanner();
    expect(banner()).not.toBeInTheDocument();
  });

  it('Accept stores consent, enables PostHog, and dismisses the banner', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(getConsent()).toBe('granted');
    expect(enablePostHog).toHaveBeenCalledTimes(1);
    expect(banner()).not.toBeInTheDocument();
  });

  it('Decline stores denial, does NOT enable PostHog, and dismisses the banner', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(getConsent()).toBe('denied');
    expect(enablePostHog).not.toHaveBeenCalled();
    expect(banner()).not.toBeInTheDocument();
  });
});
