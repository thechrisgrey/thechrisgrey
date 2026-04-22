import { useEffect, useRef, useState } from 'react';
import { typography } from '../../utils/typography';

interface MermaidDiagramProps {
  source: string;
}

let renderIdCounter = 0;

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    (async () => {
      try {
        const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([
          import('mermaid'),
          import('dompurify'),
        ]);
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily:
            '"SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif',
          themeVariables: {
            primaryColor: '#1A2332',
            primaryTextColor: '#FFFFFF',
            primaryBorderColor: '#C5A572',
            lineColor: '#C5A572',
            secondaryColor: '#2E4A6B',
            tertiaryColor: '#0A0F1C',
            background: '#0A0F1C',
            mainBkg: '#1A2332',
            nodeBorder: '#C5A572',
          },
        });
        const id = `blueprint-mermaid-${renderIdCounter++}`;
        const { svg: rendered } = await mermaid.render(id, source);
        if (cancelled) return;
        // Defense in depth: DOMPurify strips scripts, event handlers, and
        // foreignObject tricks even though mermaid's strict mode already
        // sanitizes. Blueprint output is LLM-generated, so double-check.
        const sanitized = DOMPurify.sanitize(rendered, {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
        setSvg(sanitized);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to render the diagram.';
        setError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <div className="rounded-lg bg-altivum-navy/60 border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-altivum-dark/50 border-b border-white/5">
        <span className="text-altivum-silver" style={typography.smallText}>
          Architecture diagram
        </span>
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="inline-flex items-center text-altivum-silver hover:text-altivum-gold transition-colors"
          style={typography.smallText}
          aria-expanded={showSource}
        >
          <span className="material-icons text-sm mr-1" aria-hidden="true">
            {showSource ? 'image' : 'code'}
          </span>
          {showSource ? 'View diagram' : 'View source'}
        </button>
      </div>

      {showSource ? (
        <pre
          className="p-4 text-altivum-silver overflow-x-auto"
          style={typography.smallText}
        >
          {source}
        </pre>
      ) : (
        <div ref={containerRef} className="p-4 overflow-x-auto" aria-live="polite">
          {error ? (
            <div className="text-altivum-silver/80" style={typography.smallText}>
              <span className="text-rose-300">Diagram render failed.</span> You can still read
              the Mermaid source below.
              <pre className="mt-2 text-altivum-silver overflow-x-auto">{source}</pre>
            </div>
          ) : svg === null ? (
            <div
              className="flex items-center justify-center h-32 text-altivum-silver/70"
              style={typography.smallText}
              role="status"
              aria-label="Rendering diagram"
            >
              <span
                className="w-5 h-5 mr-2 border-2 border-altivum-gold/30 border-t-altivum-gold rounded-full animate-spin"
                aria-hidden="true"
              />
              Rendering diagram…
            </div>
          ) : (
            // Sanitized via DOMPurify above + mermaid strict mode; no user-typed
            // HTML reaches this path — only rendered-then-sanitized SVG.
            <div
              className="mermaid-rendered flex justify-center"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default MermaidDiagram;
