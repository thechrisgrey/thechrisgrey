describe('Home (editorial redesign)', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load the page successfully', () => {
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('renders the bento hero with the accessible name', () => {
    // The h1 lives inside the scene tile as real DOM text (works with the
    // SVG ridge fallback too — no WebGL dependency).
    cy.get('h1').should('contain.text', 'Christian').and('contain.text', 'Perez');
    cy.get('section[aria-label="Introduction"]').within(() => {
      cy.contains('(FOUNDER & CEO — ALTIVUM INC.)').should('be.visible');
      cy.contains('Green Beret · Founder · Author · Host').should('be.visible');
    });
  });

  it('renders the hero satellite tiles', () => {
    cy.get('section[aria-label="Introduction"]').within(() => {
      // Intro tile copy (cascade-revealed; retries cover the fade-in)
      cy.contains('Special Forces medic turned founder').should('be.visible');
      // Stat tile caption
      cy.contains('SF Medical Sergeant').should('be.visible');
      // Contact pill
      cy.contains('a', 'Contact').should('have.attr', 'href', '/contact');
    });
  });

  it('hero wayfinding tiles navigate', () => {
    cy.get('section[aria-label="Introduction"]')
      .contains('a', 'The Vector')
      .click();
    cy.location('pathname').should('eq', '/podcast');
  });

  it('reveals the About section on scroll', () => {
    // The SplitReveal words are scrub-linked (opacity follows scroll between
    // 'top 82%' and 'top 50%'), so this test must genuinely park the section
    // top at the viewport top. Two traps:
    // 1. cy.scrollIntoView scrolls the minimum amount — the section can land
    //    with its top near the viewport bottom, leaving the scrub at 0.
    // 2. On slow loads the app is still mounting after cy.visit resolves:
    //    ScrollToTop's late effects (lenis still null) yank the scroll back
    //    to 0. Lenis tags <html class="lenis"> once it initializes — wait for
    //    that, then self-heal: re-issue the jump on every retry until the
    //    scrub has fully revealed the words.
    cy.get('html.lenis').should('exist');
    cy.get('section[aria-label="About"]').then(($section) => {
      const section = $section[0];
      cy.window().should((win) => {
        const y = section.getBoundingClientRect().top + win.scrollY;
        if (Math.abs(win.scrollY - y) > 2) win.scrollTo(0, y);
        const words = section.querySelectorAll<HTMLElement>('.split-word-inner');
        expect(words.length, 'split words rendered').to.be.greaterThan(0);
        // Parked at the section top the scrub sits at ~0.98 for the last
        // word; a yanked-to-top page leaves it at exactly 0. Anything > 0
        // already passes Cypress's be.visible — 0.5 separates the two states.
        const last = words[words.length - 1];
        expect(
          parseFloat(win.getComputedStyle(last).opacity),
          'last split word opacity'
        ).to.be.greaterThan(0.5);
      });
    });
    cy.get('section[aria-label="About"]').within(() => {
      cy.contains('(ABOUT)').should('be.visible');
      // SplitReveal splits the headline into word spans — assert per word
      cy.contains('QUIET').should('be.visible');
      cy.contains('RELENTLESS').should('be.visible');
      cy.contains('EXECUTION.').should('be.visible');
      cy.contains('a', 'The Full Story').should('have.attr', 'href', '/about');
    });
  });

  it('shows the record stats on scroll', () => {
    cy.get('section[aria-label="The record"]').scrollIntoView();
    cy.get('section[aria-label="The record"]').within(() => {
      cy.contains('(THE RECORD)').should('be.visible');
      cy.contains('Special Forces Medical Sergeant').should('be.visible');
      cy.contains('podcast episodes & conversations').should('be.visible');
      cy.contains('ventures built and operating').should('be.visible');
    });
  });

  it('shows the ventures panels with links', () => {
    cy.get('section[aria-label="Ventures"]').scrollIntoView();
    cy.contains('(VENTURES)').should('be.visible');
    cy.get('[data-ventures-track] a').should('have.length', 4);
    cy.get('[data-ventures-track] a').first().should('have.attr', 'href', '/altivum');
    cy.get('[data-ventures-track]').within(() => {
      cy.contains('Altivum').should('be.visible');
    });
  });

  it('shows the interlude pull-quote', () => {
    cy.get('section[aria-label="Interlude"]').scrollIntoView();
    cy.contains('The standard is the standard').should('be.visible');
  });

  it('CTA pills are wired', () => {
    cy.get('section[aria-label="Get in touch"]').scrollIntoView();
    cy.get('section[aria-label="Get in touch"]').within(() => {
      cy.contains('(NEXT)').should('be.visible');
      cy.contains('BUILD SOMETHING').should('be.visible');
      cy.contains('WORTH KEEPING.').should('be.visible');
      cy.contains('a', 'Start a conversation').should('have.attr', 'href', '/contact');
      cy.contains('button', 'Newsletter').should('be.visible');
    });
  });

  it('should have correct SEO meta tags', () => {
    cy.verifySEO('Christian Perez');
    cy.get('head meta[property="og:url"]')
      .should('have.attr', 'content')
      .and('include', 'thechrisgrey.com');
  });

  it('should display the navigation bar', () => {
    cy.verifyNavigation();
  });

  it('should display the footer', () => {
    cy.scrollTo('bottom');
    cy.verifyFooter();
  });

  it('should display the chat widget FAB', () => {
    cy.get('button[aria-label="Open chat"]').should('be.visible');
  });

  it('should be responsive on mobile viewport', () => {
    cy.viewport('iphone-x');
    cy.get('h1').should('contain.text', 'Christian').and('contain.text', 'Perez');
    cy.get('section[aria-label="Introduction"]').within(() => {
      cy.contains('a', 'The Vector').should('exist');
    });
  });
});
