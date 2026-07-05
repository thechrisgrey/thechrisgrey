import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MermaidDiagram from './MermaidDiagram';

// The component dynamically imports the heavy `mermaid` library and
// `dompurify`. Mock both so tests never load the real rendering engine.
// mermaid is called as: mermaid.initialize(config) then
// `const { svg } = await mermaid.render(id, source)`.
const renderMock = vi.fn();
const initializeMock = vi.fn();

vi.mock('mermaid', () => ({
  default: {
    initialize: (...args: unknown[]) => initializeMock(...args),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

// DOMPurify.sanitize is called on the rendered SVG string and returns the
// sanitized markup. The mock passes the markup straight through so the test
// can assert the rendered SVG reaches the DOM.
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html,
  },
}));

const SOURCE = 'graph TD; A-->B;';

describe('MermaidDiagram', () => {
  beforeEach(() => {
    renderMock.mockReset();
    initializeMock.mockReset();
  });

  it('should render the diagram chrome with a source toggle', () => {
    renderMock.mockResolvedValue({ svg: '<svg id="ok"></svg>' });
    render(<MermaidDiagram source={SOURCE} />);
    expect(screen.getByText('Architecture diagram')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view source/i })).toBeInTheDocument();
  });

  it('should show a rendering status before the diagram resolves', () => {
    // Never-resolving promise keeps the component in its loading state.
    renderMock.mockReturnValue(new Promise(() => {}));
    render(<MermaidDiagram source={SOURCE} />);
    expect(screen.getByText('Rendering diagram…')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Rendering diagram' })).toBeInTheDocument();
  });

  it('should initialize mermaid and render the provided source', async () => {
    renderMock.mockResolvedValue({ svg: '<svg id="rendered-diagram"></svg>' });
    const { container } = render(<MermaidDiagram source={SOURCE} />);

    await waitFor(() => {
      expect(container.querySelector('#rendered-diagram')).toBeInTheDocument();
    });

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    // render is called with (id, source) — assert the source is passed through.
    expect(renderMock).toHaveBeenCalledWith(expect.any(String), SOURCE);
  });

  it('should inject the sanitized svg into the rendered container', async () => {
    renderMock.mockResolvedValue({ svg: '<svg id="injected"></svg>' });
    const { container } = render(<MermaidDiagram source={SOURCE} />);

    await waitFor(() => {
      expect(container.querySelector('.mermaid-rendered')).toBeInTheDocument();
    });
    expect(container.querySelector('.mermaid-rendered svg#injected')).toBeInTheDocument();
  });

  it('should show an error fallback with the source when rendering fails', async () => {
    renderMock.mockRejectedValue(new Error('bad syntax'));
    render(<MermaidDiagram source={SOURCE} />);

    expect(await screen.findByText('Diagram render failed.')).toBeInTheDocument();
    // The Mermaid source remains visible so the user can still read it.
    const sources = screen.getAllByText(SOURCE);
    expect(sources.length).toBeGreaterThan(0);
  });

  it('should toggle between the diagram and the raw source view', async () => {
    renderMock.mockResolvedValue({ svg: '<svg id="toggle"></svg>' });
    const user = userEvent.setup();
    const { container } = render(<MermaidDiagram source={SOURCE} />);

    await waitFor(() => {
      expect(container.querySelector('#toggle')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('button', { name: /view source/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    const backToDiagram = screen.getByRole('button', { name: /view diagram/i });
    expect(backToDiagram).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(SOURCE)).toBeInTheDocument();
    // Diagram is no longer mounted while viewing source.
    expect(container.querySelector('#toggle')).not.toBeInTheDocument();
  });
});
