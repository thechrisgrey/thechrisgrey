describe('Mobile Navigation', () => {
  const overlay = '[role="dialog"][aria-label="Site menu"]';

  beforeEach(() => {
    cy.viewport('iphone-x');
    cy.visit('/');
  });

  it('should display the hamburger menu button', () => {
    cy.get('button[aria-label="Open menu"]').should('be.visible');
  });

  it('should not display desktop nav links on mobile', () => {
    // Desktop nav items are in a div.hidden.md:flex which is display:none on mobile
    cy.get('nav a[href="/blog"]').should('not.be.visible');
    cy.get('nav a[href="/contact"]').should('not.be.visible');
  });

  it('should open the full-screen menu overlay when clicking the hamburger button', () => {
    cy.get('button[aria-label="Open menu"]').click();

    // The menu is a full-screen overlay portaled to <body>
    cy.get(overlay).should('be.visible');
    cy.get(overlay).within(() => {
      cy.contains('(MENU)').should('be.visible');
      cy.contains('Home').should('be.visible');
      cy.contains('Blog').should('be.visible');
      cy.contains('Alti').should('be.visible');
      cy.contains('Links').should('be.visible');
      cy.contains('Contact').should('be.visible');
    });
  });

  it('should display the About section with all sub-items in the overlay', () => {
    cy.get('button[aria-label="Open menu"]').click();

    cy.get(overlay).within(() => {
      // About section eyebrow
      cy.contains('(ABOUT)').should('be.visible');

      // Sub-items
      cy.contains('Personal Biography').should('be.visible');
      cy.contains('Altivum Inc').should('be.visible');
      cy.contains('The Altivum Foundation').should('be.visible');
      cy.contains('The Vector Podcast').should('be.visible');
      cy.contains('Beyond the Assessment').should('be.visible');
      cy.contains('Amazon Web Services').should('be.visible');
      cy.contains('Claude').should('be.visible');
      cy.contains('thechrisgrey Blueprint').should('be.visible');
    });
  });

  it('should close the overlay after clicking the close button', () => {
    cy.get('button[aria-label="Open menu"]').click();
    cy.get(overlay).should('be.visible');

    // The hamburger also relabels to "Close menu" when open — scope to the
    // close button inside the dialog.
    cy.get(overlay).find('button[aria-label="Close menu"]').click();

    cy.get(overlay).should('not.exist');
    cy.get('button[aria-label="Open menu"]').should('be.visible');
  });

  it('should close the overlay with the Escape key', () => {
    cy.get('button[aria-label="Open menu"]').click();

    // The focus trap moves focus to the first focusable element (the close
    // button) once the overlay mounts.
    cy.get(overlay).find('button[aria-label="Close menu"]').should('have.focus');
    cy.focused().type('{esc}');

    cy.get(overlay).should('not.exist');
  });

  it('should navigate to a page and close the overlay', () => {
    cy.get('button[aria-label="Open menu"]').click();

    // Click the Contact link inside the overlay
    cy.get(overlay).contains('a', 'Contact').click();

    cy.url().should('include', '/contact');
    // Menu should be closed after navigation
    cy.get(overlay).should('not.exist');
    cy.get('button[aria-label="Open menu"]').should('be.visible');
  });

  it('should navigate to an About sub-page from the overlay', () => {
    cy.get('button[aria-label="Open menu"]').click();
    cy.get(overlay).contains('a', 'Personal Biography').click();

    cy.url().should('include', '/about');
    cy.get(overlay).should('not.exist');
  });

  it('should navigate to Altivum from the overlay', () => {
    cy.get('button[aria-label="Open menu"]').click();
    cy.get(overlay).contains('a', 'Altivum Inc').click();

    cy.url().should('include', '/altivum');
    cy.get(overlay).should('not.exist');
  });

  it('should display the logo on mobile', () => {
    cy.get('nav').within(() => {
      cy.get('img[alt="TCG Logo"]').should('be.visible');
    });
  });

  it('should display the chat widget on mobile', () => {
    cy.get('button[aria-label="Open chat"]').should('be.visible');
  });
});
