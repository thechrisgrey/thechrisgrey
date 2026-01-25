import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import logo from '../assets/logo.png';
import { typography } from '../utils/typography';

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/blog', label: 'Blog' },
  { path: '/chat', label: 'AI Chat' },
  { path: '/links', label: 'Links' },
  { path: '/contact', label: 'Contact' },
];

const ABOUT_DROPDOWN_ITEMS = [
  { path: '/about', label: 'Personal Biography' },
  { path: '/altivum', label: 'Altivum Inc' },
  { path: '/podcast', label: 'The Vector Podcast' },
  { path: '/beyond-the-assessment', label: 'Beyond the Assessment' },
];

const Navigation = () => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAboutDropdownOpen, setIsAboutDropdownOpen] = useState(false);
  const [focusedDropdownIndex, setFocusedDropdownIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      if (location.pathname === '/') {
        // Nav becomes solid after hero + summary sections (100vh + 500vh = 600vh)
        const summaryEndPosition = window.innerHeight * 6;
        setIsScrolled(window.scrollY > summaryEndPosition);
      } else {
        // For other pages, solid as soon as scrolled
        setIsScrolled(window.scrollY > 20);
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll);
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 opacity-0 animate-nav-fade-in ${isScrolled ? 'bg-altivum-navy/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
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
          <Link to="/" className="flex items-center">
            <img src={logo} alt="TCG Logo" className="h-16 w-16" />
            <div className="flex flex-col -ml-2">
              <span className="text-white tracking-tight" style={{ ...typography.cardTitleLarge, fontWeight: 700 }}>
                CHRISTIAN <span className="text-altivum-gold">PEREZ</span>
              </span>
              <span className="text-altivum-silver tracking-wider" style={typography.smallText}>
                thechrisgrey
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1 lg:ml-auto lg:mr-[-10rem]">
            <Link
              to="/"
              className={`px-4 py-2 rounded-md text-sm font-medium tracking-wide transition-all duration-200 ${isActive('/')
                ? 'text-altivum-gold bg-altivum-blue/30'
                : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                }`}
            >
              Home
            </Link>

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
                  className="absolute top-full left-0 mt-2 w-56 bg-altivum-navy/95 backdrop-blur-md rounded-md shadow-lg border border-altivum-slate/30 overflow-hidden"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {ABOUT_DROPDOWN_ITEMS.map((item, index) => (
                    item.path ? (
                      <Link
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
                      </Link>
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
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-md text-sm font-medium tracking-wide transition-all duration-200 ${isActive(item.path)
                  ? 'text-altivum-gold bg-altivum-blue/30'
                  : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                  }`}
              >
                {item.label}
              </Link>
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

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 bg-altivum-navy/95 backdrop-blur-md">
            <div className="flex flex-col space-y-2">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-md text-base font-medium transition-all duration-200 ${isActive('/')
                  ? 'text-altivum-gold bg-altivum-blue/30'
                  : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                  }`}
              >
                Home
              </Link>

              {/* About Section */}
              <div className="px-4 py-2">
                <div className="text-xs font-semibold text-altivum-gold uppercase tracking-wider mb-2">About</div>
                <div className="flex flex-col space-y-1 ml-2">
                  {ABOUT_DROPDOWN_ITEMS.map((item, index) => (
                    item.path ? (
                      <Link
                        key={index}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isActive(item.path)
                          ? 'text-altivum-gold bg-altivum-blue/30'
                          : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                          }`}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <div
                        key={index}
                        className="px-4 py-2 text-sm font-medium text-altivum-slate"
                      >
                        {item.label}
                      </div>
                    )
                  ))}
                </div>
              </div>

              {NAV_ITEMS.slice(1).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-md text-base font-medium transition-all duration-200 ${isActive(item.path)
                    ? 'text-altivum-gold bg-altivum-blue/30'
                    : 'text-altivum-silver hover:text-white hover:bg-altivum-blue/20'
                    }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
