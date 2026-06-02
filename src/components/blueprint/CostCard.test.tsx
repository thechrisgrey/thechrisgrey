import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CostCard from './CostCard';
import type { CostEstimate } from '../../types/blueprint';

const baseCost: CostEstimate = {
  monthly_low_usd: 120,
  monthly_high_usd: 480,
  assumptions: [
    '1M Lambda invocations per month',
    '10 GB DynamoDB storage',
  ],
};

describe('CostCard', () => {
  describe('priced estimate', () => {
    it('should render the monthly cost estimate label', () => {
      render(<CostCard cost={baseCost} />);
      expect(screen.getByText('Monthly cost estimate')).toBeInTheDocument();
    });

    it('should render the formatted low-to-high range', () => {
      render(<CostCard cost={baseCost} />);
      expect(screen.getByText(/\$120\s*–\s*\$480/)).toBeInTheDocument();
    });

    it('should render the per-month suffix when not free', () => {
      render(<CostCard cost={baseCost} />);
      expect(screen.getByText('/ month')).toBeInTheDocument();
    });

    it('should format large numbers with thousands separators', () => {
      const cost: CostEstimate = {
        ...baseCost,
        monthly_low_usd: 1500,
        monthly_high_usd: 25000,
      };
      render(<CostCard cost={cost} />);
      expect(screen.getByText(/\$1,500\s*–\s*\$25,000/)).toBeInTheDocument();
    });

    it('should round fractional dollar amounts to whole dollars', () => {
      const cost: CostEstimate = {
        ...baseCost,
        monthly_low_usd: 99.6,
        monthly_high_usd: 250.4,
      };
      render(<CostCard cost={cost} />);
      expect(screen.getByText(/\$100\s*–\s*\$250/)).toBeInTheDocument();
    });

    it('should render a placeholder for non-finite values', () => {
      const cost: CostEstimate = {
        ...baseCost,
        monthly_low_usd: Number.NaN,
        monthly_high_usd: Number.POSITIVE_INFINITY,
      };
      render(<CostCard cost={cost} />);
      // Both bounds fall back to the em-dash placeholder.
      expect(screen.getByText(/\$—\s*–\s*\$—/)).toBeInTheDocument();
    });
  });

  describe('free tier', () => {
    it('should render the Free tier label when the high bound is zero', () => {
      const cost: CostEstimate = {
        ...baseCost,
        monthly_low_usd: 0,
        monthly_high_usd: 0,
      };
      render(<CostCard cost={cost} />);
      expect(screen.getByText('Free tier')).toBeInTheDocument();
    });

    it('should not render the per-month suffix on the free tier', () => {
      const cost: CostEstimate = {
        ...baseCost,
        monthly_low_usd: 0,
        monthly_high_usd: 0,
      };
      render(<CostCard cost={cost} />);
      expect(screen.queryByText('/ month')).not.toBeInTheDocument();
    });

    it('should not render a dollar range on the free tier', () => {
      const cost: CostEstimate = {
        ...baseCost,
        monthly_low_usd: 0,
        monthly_high_usd: 0,
      };
      render(<CostCard cost={cost} />);
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });
  });

  describe('assumptions', () => {
    it('should render the assumptions heading', () => {
      render(<CostCard cost={baseCost} />);
      expect(screen.getByText('Based on these assumptions:')).toBeInTheDocument();
    });

    it('should render every assumption as a list item', () => {
      render(<CostCard cost={baseCost} />);
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(
        screen.getByText('1M Lambda invocations per month')
      ).toBeInTheDocument();
      expect(screen.getByText('10 GB DynamoDB storage')).toBeInTheDocument();
    });

    it('should render no list items when assumptions are empty', () => {
      const cost: CostEstimate = { ...baseCost, assumptions: [] };
      render(<CostCard cost={cost} />);
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });
  });
});
