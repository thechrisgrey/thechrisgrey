import { typography } from '../../utils/typography';
import { COST_SIGNAL_LABELS, type ServiceEntry } from '../../types/blueprint';

interface ServiceListProps {
  services: ServiceEntry[];
}

const costSignalTone: Record<string, string> = {
  'free-tier': 'text-emerald-300 border-emerald-400/30 bg-emerald-400/5',
  low: 'text-altivum-gold border-altivum-gold/30 bg-altivum-gold/5',
  medium: 'text-amber-200 border-amber-300/30 bg-amber-300/5',
  high: 'text-rose-300 border-rose-400/30 bg-rose-400/5',
};

export function ServiceList({ services }: ServiceListProps) {
  return (
    <ul className="space-y-3" aria-label="Services in this architecture">
      {services.map((entry, idx) => {
        const tone = costSignalTone[entry.cost_signal] || 'text-altivum-silver border-white/10 bg-white/5';
        return (
          <li
            key={`${entry.service}-${idx}`}
            className="p-4 rounded-lg bg-altivum-navy/60 border border-white/5 hover:border-altivum-gold/20 transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <h4 className="text-white" style={typography.cardTitleSmall}>
                {entry.service}
              </h4>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full border ${tone}`}
                style={typography.smallText}
                aria-label={`Cost tier ${COST_SIGNAL_LABELS[entry.cost_signal] ?? entry.cost_signal}`}
              >
                {COST_SIGNAL_LABELS[entry.cost_signal] ?? entry.cost_signal}
              </span>
            </div>
            <p className="text-altivum-silver mb-2" style={typography.bodyText}>
              {entry.purpose}
            </p>
            <p className="text-altivum-silver/80" style={typography.smallText}>
              <span className="text-altivum-gold">Why:</span> {entry.rationale}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export default ServiceList;
