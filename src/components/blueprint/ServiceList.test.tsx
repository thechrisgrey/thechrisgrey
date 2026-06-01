import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceList } from './ServiceList';
import { COST_SIGNAL_LABELS, type ServiceEntry } from '../../types/blueprint';

function makeEntry(overrides: Partial<ServiceEntry> = {}): ServiceEntry {
  return {
    service: 'AWS Lambda',
    purpose: 'Run serverless compute on demand',
    rationale: 'Scales to zero and avoids idle cost',
    cost_signal: 'low',
    ...overrides,
  };
}

describe('ServiceList', () => {
  it('should render the labelled list', () => {
    render(<ServiceList services={[makeEntry()]} />);
    expect(
      screen.getByRole('list', { name: /services in this architecture/i })
    ).toBeInTheDocument();
  });

  it('should render each service name, purpose, and rationale', () => {
    render(<ServiceList services={[makeEntry()]} />);
    expect(screen.getByText('AWS Lambda')).toBeInTheDocument();
    expect(screen.getByText('Run serverless compute on demand')).toBeInTheDocument();
    expect(screen.getByText(/Scales to zero and avoids idle cost/)).toBeInTheDocument();
  });

  it('should render the "Why:" rationale prefix', () => {
    render(<ServiceList services={[makeEntry()]} />);
    expect(screen.getByText('Why:')).toBeInTheDocument();
  });

  it('should render one list item per service', () => {
    const services = [
      makeEntry({ service: 'AWS Lambda' }),
      makeEntry({ service: 'Amazon DynamoDB' }),
      makeEntry({ service: 'Amazon S3' }),
    ];
    render(<ServiceList services={services} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('AWS Lambda')).toBeInTheDocument();
    expect(screen.getByText('Amazon DynamoDB')).toBeInTheDocument();
    expect(screen.getByText('Amazon S3')).toBeInTheDocument();
  });

  it('should render an empty list when no services are provided', () => {
    render(<ServiceList services={[]} />);
    const list = screen.getByRole('list', { name: /services in this architecture/i });
    expect(list).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  describe('cost_signal branches', () => {
    it('should render the "Free tier" badge for free-tier', () => {
      render(<ServiceList services={[makeEntry({ cost_signal: 'free-tier' })]} />);
      const badge = screen.getByText(COST_SIGNAL_LABELS['free-tier']);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute(
        'aria-label',
        `Cost tier ${COST_SIGNAL_LABELS['free-tier']}`
      );
      expect(badge.className).toContain('text-emerald-300');
    });

    it('should render the "Low" badge for low', () => {
      render(<ServiceList services={[makeEntry({ cost_signal: 'low' })]} />);
      const badge = screen.getByText(COST_SIGNAL_LABELS.low);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('text-altivum-gold');
    });

    it('should render the "Medium" badge for medium', () => {
      render(<ServiceList services={[makeEntry({ cost_signal: 'medium' })]} />);
      const badge = screen.getByText(COST_SIGNAL_LABELS.medium);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('text-amber-200');
    });

    it('should render the "High" badge for high', () => {
      render(<ServiceList services={[makeEntry({ cost_signal: 'high' })]} />);
      const badge = screen.getByText(COST_SIGNAL_LABELS.high);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('text-rose-300');
    });

    it('should fall back to the raw value and neutral tone for an unknown cost_signal', () => {
      // Exercise the `?? entry.cost_signal` and default-tone fallbacks.
      const unknown = makeEntry({
        cost_signal: 'unbounded' as ServiceEntry['cost_signal'],
      });
      render(<ServiceList services={[unknown]} />);
      const badge = screen.getByText('unbounded');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'Cost tier unbounded');
      expect(badge.className).toContain('text-altivum-silver');
    });
  });
});
