import { type AnchorHTMLAttributes, forwardRef, useCallback } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { prefetchRoute } from '../utils/routeManifest';

type ViewTransitionLinkProps = LinkProps & {
  to: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

const ViewTransitionLink = forwardRef<HTMLAnchorElement, ViewTransitionLinkProps>(
  ({ to, onClick, onMouseEnter, onFocus, ...props }, ref) => {
    const transitionNavigate = useViewTransitionNavigate();

    const handlePrefetch = useCallback(() => {
      prefetchRoute(to);
    }, [to]);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onClick?.(e);
        transitionNavigate(to);
      },
      [to, onClick, transitionNavigate],
    );

    return (
      <Link
        ref={ref}
        to={to}
        onClick={handleClick}
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
  },
);

ViewTransitionLink.displayName = 'ViewTransitionLink';

export default ViewTransitionLink;
