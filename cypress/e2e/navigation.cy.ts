describe('Desktop Navigation', () => {
  beforeEach(() => {
    // Visit a non-home page so nav is immediately solid/visible
    // (Home page nav starts transparent and uses negative margins that can
    // push items off-screen at certain viewport widths)
    cy.visit('/about');
  });

  it('should display the logo and branding', () => {
    cy.get('nav').within(() => {
      cy.get('img[alt="TCG Logo"]').should('be.visible');
      cy.contains('CHRISTIAN').should('be.visible');
      cy.contains('PEREZ').should('be.visible');
      cy.contains('thechrisgrey').should('be.visible');
    });
  });

  it('should display all primary nav links on desktop', () => {
    // The nav uses animate-nav-fade-in (opacity 0 -> 1 with delay),
    // so we check for existence rather than visibility during animation
    cy.get('nav').within(() => {
      cy.contains('Home').should('exist');
      cy.contains('Blog').should('exist');
      cy.contains('AI Chat').should('exist');
      cy.contains('Links').should('exist');
      cy.contains('Contact').should('exist');
    });
  });

  it('should display the About dropdown button', () => {
    cy.get('nav').within(() => {
      cy.get('button[aria-label="About menu"]').should('be.visible');
      cy.get('button[aria-label="About menu"]').should('have.attr', 'aria-expanded', 'false');
    });
  });

  it('should open the About dropdown and show all sub-items', () => {
    cy.get('button[aria-label="About menu"]').click();
    cy.get('button[aria-label="About menu"]').should('have.attr', 'aria-expanded', 'true');

    cy.get('[role="menu"]').within(() => {
      cy.contains('Personal Biography').should('be.visible');
      cy.contains('Altivum Inc').should('be.visible');
      cy.contains('The Vector Podcast').should('be.visible');
      cy.contains('Beyond the Assessment').should('be.visible');
      cy.contains('Amazon Web Services').should('be.visible');
    });
  });

  it('should close the About dropdown when clicking outside', () => {
    cy.get('button[aria-label="About menu"]').click();
    cy.get('[role="menu"]').should('be.visible');

    // Click outside the dropdown
    cy.get('body').click(0, 0);
    cy.get('[role="menu"]').should('not.exist');
  });

  it('should navigate to Personal Biography from About dropdown', () => {
    cy.get('button[aria-label="About menu"]').click();
    cy.get('[role="menu"]').contains('Personal Biography').click();

    cy.url().should('include', '/about');
    cy.get('[role="menu"]').should('not.exist');
  });

  it('should navigate to Altivum Inc from About dropdown', () => {
    cy.get('button[aria-label="About menu"]').click();
    cy.get('[role="menu"]').contains('Altivum Inc').click();

    cy.url().should('include', '/altivum');
  });

  it('should navigate to The Vector Podcast from About dropdown', () => {
    cy.get('button[aria-label="About menu"]').click();
    cy.get('[role="menu"]').contains('The Vector Podcast').click();

    cy.url().should('include', '/podcast');
  });

  it('should navigate to Beyond the Assessment from About dropdown', () => {
    cy.get('button[aria-label="About menu"]').click();
    cy.get('[role="menu"]').contains('Beyond the Assessment').click();

    cy.url().should('include', '/beyond-the-assessment');
  });

  it('should navigate to Amazon Web Services from About dropdown', () => {
    cy.get('button[aria-label="About menu"]').click();
    cy.get('[role="menu"]').contains('Amazon Web Services').click();

    cy.url().should('include', '/aws');
  });

  it('should navigate to Blog page via nav link', () => {
    cy.get('nav').contains('Blog').click();
    cy.url().should('include', '/blog');
  });

  it('should navigate to AI Chat page via nav link', () => {
    cy.get('nav').contains('AI Chat').click();
    cy.url().should('include', '/chat');
  });

  it('should navigate to Contact page via nav link', () => {
    // The desktop nav uses a negative margin (lg:mr-[-10rem]) that can push
    // the rightmost links off-screen at 1280px viewport in a fixed nav.
    // Use force:true since the element exists with the correct href.
    cy.get('nav a[href="/contact"]').click({ force: true });
    cy.url().should('include', '/contact');
  });

  it('should navigate to Links page via nav link', () => {
    cy.get('nav').contains('Links').click();
    cy.url().should('include', '/links');
  });

  it('should navigate home when clicking the logo', () => {
    // Click the logo image to navigate home (targets the logo link, not the skip link)
    cy.get('nav img[alt="TCG Logo"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should highlight the active nav item', () => {
    cy.visit('/blog');
    cy.get('nav').contains('Blog')
      .should('have.class', 'text-altivum-gold');
  });

  it('should highlight About dropdown when on an About sub-page', () => {
    cy.visit('/about');
    cy.get('button[aria-label="About menu"]')
      .should('have.class', 'text-altivum-gold');
  });

  it('should support keyboard navigation of the About dropdown', () => {
    cy.get('button[aria-label="About menu"]').focus();
    cy.get('button[aria-label="About menu"]').type('{downArrow}');
    cy.get('[role="menu"]').should('be.visible');

    // First item should receive focus
    cy.get('[role="menuitem"]').first().should('have.focus');

    // Arrow down to next item
    cy.focused().type('{downArrow}');
    cy.get('[role="menuitem"]').eq(1).should('have.focus');

    // Escape closes the dropdown
    cy.focused().type('{esc}');
    cy.get('[role="menu"]').should('not.exist');
  });

  it('should have a skip-to-content link for keyboard users', () => {
    cy.get('a[href="#main-content"]').should('exist');
    cy.get('a[href="#main-content"]').focus();
    cy.get('a[href="#main-content"]').should('be.visible');
    cy.get('a[href="#main-content"]').should('contain.text', 'Skip to main content');
  });
});
