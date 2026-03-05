import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HighlightedCodeBlock from './HighlightedCodeBlock';

// Mock shiki to avoid loading WASM in tests
vi.mock('shiki', () => ({
  codeToHtml: vi.fn().mockResolvedValue('<pre><code class="highlighted">mock code</code></pre>'),
}));

describe('HighlightedCodeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show plain text fallback initially', () => {
    render(<HighlightedCodeBlock code="const x = 1;" language="javascript" />);
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('should render the highlighted HTML once shiki loads', async () => {
    const { container } = render(
      <HighlightedCodeBlock code="const x = 1;" language="javascript" />
    );

    await waitFor(() => {
      // The mock returns a pre/code tag that gets rendered via innerHTML
      // Look for the wrapper div with 'not-prose' class that only appears after highlight
      const highlightWrapper = container.querySelector('.not-prose');
      expect(highlightWrapper).toBeInTheDocument();
    });
  });

  it('should display filename when provided', () => {
    render(<HighlightedCodeBlock code="x = 1" language="python" filename="app.py" />);
    expect(screen.getByText('app.py')).toBeInTheDocument();
  });

  it('should not display filename when not provided', () => {
    const { container } = render(
      <HighlightedCodeBlock code="x = 1" language="python" />
    );
    // No filename div should exist
    expect(container.querySelector('.font-mono.text-xs')).not.toBeInTheDocument();
  });

  it('should display language label when provided', () => {
    render(<HighlightedCodeBlock code="code" language="typescript" />);
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('should not display language label when not provided', () => {
    render(<HighlightedCodeBlock code="code" />);
    // No language element at the bottom
    expect(screen.queryByText('text')).not.toBeInTheDocument();
  });

  it('should gracefully handle shiki failure and keep plain text', async () => {
    const { codeToHtml } = await import('shiki');
    vi.mocked(codeToHtml).mockRejectedValueOnce(new Error('Load failed'));

    render(<HighlightedCodeBlock code="fallback code" language="go" />);

    // Should keep showing the plain text fallback
    await waitFor(() => {
      expect(screen.getByText('fallback code')).toBeInTheDocument();
    });
  });

  it('should not attempt highlighting when code is empty', () => {
    render(<HighlightedCodeBlock code="" language="javascript" />);
    // Just renders the empty code block without trying shiki
    expect(screen.queryByText('highlighted')).not.toBeInTheDocument();
  });
});
