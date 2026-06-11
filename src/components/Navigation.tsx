import { useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import logo from '../assets/logo.png';
import { typography } from '../utils/typography';
import { editorialType, EDITORIAL_FONT_FAMILY } from '../utils/editorialType';
import { useFocusTrap } from '../hooks/useFocusTrap';
import ViewTransitionLink from './ViewTransitionLink';

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/blog', label: 'Blog' },
  { path: '/chat', label: 'Alti' },
  { path: '/links', label: 'Links' },
  { path: '/contact', label: 'Contact' },
];

const ABOUT_DROPDOWN_ITEMS = [
  { path: '/about', label: 'Personal Biography' },
  { path: '/altivum', label: 'Altivum Inc' },
  { path: '/foundation', label: 'The Altivum Foundation' },
  { path: '/podcast', label: 'The Vector Podcast' },
  { path: '/beyond-the-assessment', label: 'Beyond the Assessment' },
  { path: '/aws', label: 'Amazon Web Services' },
  { path: '/claude', label: 'Claude' },
  { path: '/blueprint', label: 'thechrisgrey Blueprint' },
];

const Navigation = () => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAboutDropdownOpen, setIsAboutDropdownOpen] = useState(false);
  const [focusedDropdownIndex, setFocusedDropdownIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  const { containerRef: overlayRef, handleKeyDown: handleOverlayKeyDown } =
    useFocusTrap(isMobileMenuOpen);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const updateScrollState = () => {
      if (location.pathname === '/') {
        setIsScrolled(window.scrollY > window.innerHeight * 0.85);
      } else {
        setIsScrolled(window.scrollY > 20);
      }
    };

    // Initial check
    updateScrollState();

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateScrollState();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAboutDropdownOpen(false);
        setFocusedDropdownIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus dropdown item when index changes
  useEffect(() => {
    if (focusedDropdownIndex >= 0 && dropdownItemsRef.current[focusedDropdownIndex]) {
      dropdownItemsRef.current[focusedDropdownIndex]?.focus();
    }
  }, [focusedDropdownIndex]);

  // Keyboard navigation for dropdown
  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    const itemCount = ABOUT_DROPDOWN_ITEMS.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isAboutDropdownOpen) {
          setIsAboutDropdownOpen(true);
          setFocusedDropdownIndex(0);
        } else {
          setFocusedDropdownIndex((prev) => (prev + 1) % itemCount);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isAboutDropdownOpen) {
          setFocusedDropdownIndex((prev) => (prev - 1 + itemCount) % itemCount);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsAboutDropdownOpen(false);
        setFocusedDropdownIndex(-1);
        break;
      case 'Tab':
        setIsAboutDropdownOpen(false);
        setFocusedDropdownIndex(-1);
        break;
    }
  }, [isAboutDropdownOpen]);

  const isActive = (path: string) => location.pathname === path;

  const isAboutActive = () => {
    return ABOUT_DROPDOWN_ITEMS.some(item => item.path && location.pathname === item.path);
  };

  return (
    <nav
      data-vt-persist="navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 opacity-0 animate-nav-fade-in ${
        isScrolled
          ? 'bg-altivum-dark/95 backdrop-blur-md border-b border-altivum-gold/20'
          : 'bg-transparent'
      }`}
    >
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-altivum-gold focus:text-altivum-dark focus:font-medium focus:rounded"
      >
        Skip to main content
      </a>
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex justify-between items-center h-20">
          {/* Logo/Name */}
          <ViewTransitionLink to="/" className="flex items-center">
            <img src={logo} alt="TCG Logo" className="h-16 w-16" />
            <div className="flex flex-col -ml-2">
              <span
                className="text-altivum-porcelain"
                style={{ fontFamily: EDITORIAL_FONT_FAMILY, fontWeight: 500, fontSize: '1.25rem', letterSpacing: '0.04em' }}
              >
                CHRISTIAN <span className="italic text-altivum-gold">PEREZ</span>
              </span>
              <span className="text-altivum-silver tracking-wider" style={typography.smallText}>
                thechrisgrey
              </span>
            </div>
          </ViewTransitionLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1 lg:ml-auto">
            <ViewTransitionLink
              to="/"
              className={`px-4 py-2 rounded-md text-sm font-medium tracking-wide transition-all duration-200 ${isActive('/')
                ? 'text-altivum-gold bg-altivum-blue/30'
                : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                }`}
            >
              Home
            </ViewTransitionLink>

            {/* About Dropdown */}
            <div className="relative" ref={dropdownRef} onKeyDown={handleDropdownKeyDown}>
              <button
                onClick={() => {
                  setIsAboutDropdownOpen(!isAboutDropdownOpen);
                  setFocusedDropdownIndex(-1);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium tracking-wide transition-all duration-200 flex items-center ${isAboutActive()
                  ? 'text-altivum-gold bg-altivum-blue/30'
                  : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                  }`}
                aria-label="About menu"
                aria-expanded={isAboutDropdownOpen}
                aria-haspopup="true"
              >
                About
                <svg className={`w-4 h-4 ml-1 transition-transform duration-200 ${isAboutDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isAboutDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-56 bg-altivum-dark/95 backdrop-blur-md rounded-md shadow-lg border border-altivum-gold/15 overflow-hidden"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {ABOUT_DROPDOWN_ITEMS.map((item, index) => (
                    item.path ? (
                      <ViewTransitionLink
                        key={index}
                        ref={(el) => { dropdownItemsRef.current[index] = el; }}
                        to={item.path}
                        onClick={() => {
                          setIsAboutDropdownOpen(false);
                          setFocusedDropdownIndex(-1);
                        }}
                        role="menuitem"
                        tabIndex={focusedDropdownIndex === index ? 0 : -1}
                        className={`block px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive(item.path)
                          ? 'text-altivum-gold bg-altivum-blue/30'
                          : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                          } ${focusedDropdownIndex === index ? 'bg-altivum-blue/20' : ''}`}
                      >
                        {item.label}
                      </ViewTransitionLink>
                    ) : (
                      <div
                        key={index}
                        className="px-4 py-3 text-sm font-medium text-altivum-slate cursor-not-allowed"
                        role="menuitem"
                        aria-disabled="true"
                      >
                        {item.label}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {NAV_ITEMS.slice(1).map((item) => (
              <ViewTransitionLink
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-md text-sm font-medium tracking-wide transition-all duration-200 ${isActive(item.path)
                  ? 'text-altivum-gold bg-altivum-blue/30'
                  : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                  }`}
              >
                {item.label}
              </ViewTransitionLink>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-altivum-silver hover:text-white hover:bg-altivum-blue/20"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            <span className="material-icons" aria-hidden="true">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

        {/* Full-screen mobile overlay — portaled to <body>: the nav's persistent
            nav-fade-in transform makes it the containing block for fixed
            descendants, which would clamp inset-0 to the nav's box */}
        {isMobileMenuOpen && createPortal(
          <div
            ref={overlayRef}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsMobileMenuOpen(false);
                return;
              }
              handleOverlayKeyDown(e);
            }}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-altivum-dark px-8 pb-12 pt-24 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-6 top-6 p-2 text-altivum-silver hover:text-altivum-porcelain"
              aria-label="Close menu"
            >
              <span className="material-icons" aria-hidden="true">close</span>
            </button>

            <span className="italic text-altivum-porcelain/50" style={editorialType.eyebrow}>
              (MENU)
            </span>

            <div className="mt-8 flex flex-col gap-5">
              {[{ path: '/', label: 'Home' }, ...NAV_ITEMS.slice(1)].map((item, i) => (
                <ViewTransitionLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="opacity-0 animate-fade-in text-altivum-porcelain"
                  style={{
                    ...editorialType.displaySection,
                    fontSize: 'clamp(2rem, 8vw, 2.75rem)',
                    animationDelay: `${i * 70}ms`,
                    animationDuration: '0.6s',
                  }}
                >
                  {item.label}
                </ViewTransitionLink>
              ))}
            </div>

            <span className="mt-10 italic text-altivum-porcelain/50" style={editorialType.eyebrow}>
              (ABOUT)
            </span>
            <div className="mt-4 flex flex-col gap-3">
              {ABOUT_DROPDOWN_ITEMS.map((item, i) => (
                <ViewTransitionLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="opacity-0 animate-fade-in text-altivum-silver hover:text-altivum-gold"
                  style={{
                    fontFamily: EDITORIAL_FONT_FAMILY,
                    fontSize: '1.125rem',
                    animationDelay: `${350 + i * 50}ms`,
                    animationDuration: '0.6s',
                  }}
                >
                  {item.label}
                </ViewTransitionLink>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
    </nav>
  );
};

export default Navigation;
