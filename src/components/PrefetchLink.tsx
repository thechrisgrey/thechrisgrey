import { Link, type LinkProps } from 'react-router-dom';
import { forwardRef, useCallback } from 'react';
import { prefetchRoute } from '../utils/routeManifest';

type PrefetchLinkProps = LinkProps & {
  to: string;
};

const PrefetchLink = forwardRef<HTMLAnchorElement, PrefetchLinkProps>(
  ({ to, onMouseEnter, onFocus, ...props }, ref) => {
    const handlePrefetch = useCallback(() => {
      prefetchRoute(to);
    }, [to]);

    return (
      <Link
        ref={ref}
        to={to}
        onMouseEnter={(e) => {
          handlePrefetch();
          onMouseEnter?.(e);
        }}
        onFocus={(e) => {
          handlePrefetch();
          onFocus?.(e);
        }}
        {...props}
      />
    );
  }
);

PrefetchLink.displayName = 'PrefetchLink';

export default PrefetchLink;
