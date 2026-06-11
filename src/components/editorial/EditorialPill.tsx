import type { ReactNode } from 'react';
import ViewTransitionLink from '../ViewTransitionLink';

type PillVariant = 'gold-outline' | 'dark-solid' | 'dark-outline';

interface EditorialPillProps {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: PillVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<PillVariant, string> = {
  // On dark backgrounds
  'gold-outline':
    'border-altivum-gold text-altivum-gold hover:bg-altivum-gold/10 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)]',
  // On the porcelain CTA section
  'dark-solid':
    'border-altivum-dark bg-altivum-dark text-altivum-porcelain hover:bg-altivum-navy',
  'dark-outline':
    'border-altivum-dark/30 text-altivum-dark hover:border-altivum-dark hover:bg-altivum-dark/5',
};

const BASE_CLASSES =
  'relative z-30 inline-flex items-center justify-center rounded-full border px-7 py-3.5 ' +
  'text-xs font-medium uppercase tracking-[0.2em] transition-all duration-300 ' +
  'active:scale-[0.98] touch-manipulation min-h-[48px]';

/**
 * The editorial CTA pill — uppercase letter-spaced SF Pro inside a rounded
 * hairline border. Renders a router link (`to`), anchor (`href`), or button
 * (`onClick`) depending on which prop is provided.
 */
const EditorialPill = ({
  children,
  to,
  href,
  onClick,
  variant = 'gold-outline',
  className = '',
}: EditorialPillProps) => {
  const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`;

  if (to) {
    return (
      <ViewTransitionLink to={to} className={classes}>
        {children}
      </ViewTransitionLink>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
};

export default EditorialPill;
