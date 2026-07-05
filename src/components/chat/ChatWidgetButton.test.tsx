import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWidgetButton from './ChatWidgetButton';

// Mock AltiMascot since Three.js Canvas doesn't work in jsdom
vi.mock('./AltiMascot', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => <div data-testid="alti-mascot" data-is-open={isOpen} />,
}));

// WebGL capability gate — controllable per test.
import { checkWebGLSupport } from '../../utils/checkWebGL';
vi.mock('../../utils/checkWebGL', () => ({
  checkWebGLSupport: vi.fn(() => true),
}));
const mockedCheckWebGL = vi.mocked(checkWebGLSupport);

// Build-time prerender flag — controllable per test, default false (browser).
import { isPrerender } from '../../utils/prerender';
vi.mock('../../utils/prerender', () => ({
  isPrerender: vi.fn(() => false),
}));
const mockedIsPrerender = vi.mocked(isPrerender);

describe('ChatWidgetButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckWebGL.mockReturnValue(true);
    mockedIsPrerender.mockReturnValue(false);
  });

  it('should render with "Open chat" label when closed', () => {
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /open chat/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('should render with "Close chat" label when open', () => {
    render(<ChatWidgetButton isOpen={true} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: /close chat/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('should render AltiMascot with isOpen prop', async () => {
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    const mascot = await screen.findByTestId('alti-mascot');
    expect(mascot).toBeInTheDocument();
    expect(mascot).toHaveAttribute('data-is-open', 'false');
  });

  it('should pass isOpen=true to AltiMascot when open', async () => {
    render(<ChatWidgetButton isOpen={true} onClick={vi.fn()} />);
    const mascot = await screen.findByTestId('alti-mascot');
    expect(mascot).toHaveAttribute('data-is-open', 'true');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ChatWidgetButton isOpen={false} onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('mounts the 3D mascot when WebGL is supported', async () => {
    mockedCheckWebGL.mockReturnValue(true);
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);
    expect(await screen.findByTestId('alti-mascot')).toBeInTheDocument();
    expect(screen.queryByTestId('alti-fallback')).not.toBeInTheDocument();
  });

  it('renders a static fallback (not the 3D mascot) when WebGL is unsupported, and stays clickable', async () => {
    mockedCheckWebGL.mockReturnValue(false);
    const onClick = vi.fn();
    render(<ChatWidgetButton isOpen={false} onClick={onClick} />);

    expect(screen.getByTestId('alti-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('alti-mascot')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('skips the 3D mascot during a build-time prerender crawl, even with WebGL', async () => {
    mockedCheckWebGL.mockReturnValue(true);
    mockedIsPrerender.mockReturnValue(true);
    render(<ChatWidgetButton isOpen={false} onClick={vi.fn()} />);

    expect(screen.getByTestId('alti-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('alti-mascot')).not.toBeInTheDocument();
  });
});
