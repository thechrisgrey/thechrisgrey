import { typography } from '../../utils/typography';
import type { CostEstimate } from '../../types/blueprint';

interface CostCardProps {
  cost: CostEstimate;
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function CostCard({ cost }: CostCardProps) {
  const isFree = cost.monthly_high_usd === 0;
  const range = isFree
    ? 'Free tier'
    : `${formatUsd(cost.monthly_low_usd)} – ${formatUsd(cost.monthly_high_usd)}`;

  return (
    <div className="p-5 rounded-lg bg-altivum-navy/60 border border-white/5">
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-altivum-silver" style={typography.smallText}>
          Monthly cost estimate
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-altivum-gold" style={typography.cardTitleLarge}>
          {range}
        </span>
        {!isFree && (
          <span className="text-altivum-silver/70" style={typography.smallText}>
            / month
          </span>
        )}
      </div>
      <div>
        <p className="text-altivum-silver mb-2" style={typography.smallText}>
          Based on these assumptions:
        </p>
        <ul className="space-y-1.5">
          {cost.assumptions.map((assumption, idx) => (
            <li
              key={idx}
              className="flex gap-2 text-altivum-silver/90"
              style={typography.smallText}
            >
              <span className="text-altivum-gold/60" aria-hidden="true">
                •
              </span>
              <span>{assumption}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default CostCard;
