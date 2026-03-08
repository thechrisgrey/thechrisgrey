describe('404 Not Found Page', () => {
  beforeEach(() => {
    cy.visit('/this-page-does-not-exist', { failOnStatusCode: false });
  });

  it('should load the 404 page for an invalid route', () => {
    cy.url().should('include', '/this-page-does-not-exist');
  });

  it('should display the 404 number prominently', () => {
    cy.contains('404').should('be.visible');
  });

  it('should display the Page Not Found heading', () => {
    cy.contains('h1', 'Page Not Found').should('be.visible');
  });

  it('should display a helpful message', () => {
    cy.contains('Looks like this page went off the grid').should('be.visible');
  });

  it('should have a noindex meta tag to prevent search engine indexing', () => {
    // react-helmet-async renders a second meta[name="robots"] with data-rh="true"
    // The noindex tag coexists with the default robots tag from index.html
    cy.get('head meta[name="robots"][data-rh="true"]')
      .should('have.attr', 'content')
      .and('include', 'noindex');
  });

  it('should display a Go Home link', () => {
    cy.contains('Go Home')
      .should('be.visible')
      .and('have.attr', 'href', '/');
  });

  it('should display a Read the Blog link', () => {
    cy.contains('Read the Blog')
      .should('be.visible')
      .and('have.attr', 'href', '/blog');
  });

  it('should display a Get in Touch link', () => {
    cy.contains('Get in Touch')
      .should('be.visible')
      .and('have.attr', 'href', '/contact');
  });

  it('should display quick links to other pages', () => {
    cy.contains('Or check out these pages').should('be.visible');
    cy.contains('a', 'About').should('have.attr', 'href', '/about');
    cy.contains('a', 'Altivum Inc.').should('have.attr', 'href', '/altivum');
    cy.contains('a', 'Podcast').should('have.attr', 'href', '/podcast');
    cy.contains('a', 'Book').should('have.attr', 'href', '/beyond-the-assessment');
    cy.contains('a', 'AI Chat').should('have.attr', 'href', '/chat');
  });

  it('should navigate to the home page when clicking Go Home', () => {
    cy.contains('Go Home').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should navigate to the blog when clicking Read the Blog', () => {
    // Stub Sanity to prevent real API calls
    cy.intercept('GET', '**/k5950b3w**sanity.io/**', {
      statusCode: 200,
      body: { result: { posts: [], tags: [], series: [] } },
    });

    cy.contains('Read the Blog').click();
    cy.url().should('include', '/blog');
  });

  it('should navigate to the contact page when clicking Get in Touch', () => {
    cy.contains('Get in Touch').click();
    cy.url().should('include', '/contact');
  });

  it('should display the navigation bar', () => {
    cy.verifyNavigation();
  });

  it('should display the footer', () => {
    cy.verifyFooter();
  });

  it('should display the chat widget', () => {
    cy.get('button[aria-label="Open chat"]').should('be.visible');
  });

  it('should be responsive on mobile viewport', () => {
    cy.viewport('iphone-x');
    cy.contains('404').should('be.visible');
    cy.contains('h1', 'Page Not Found').should('be.visible');
    cy.contains('Go Home').should('be.visible');
  });

  it('should render the 404 page for various invalid routes', () => {
    const invalidRoutes = [
      '/random-path',
      '/about/something',
      '/blog-post-that-is-not-valid-route',
      '/admin-secret',
    ];

    invalidRoutes.forEach((route) => {
      cy.visit(route, { failOnStatusCode: false });
      cy.contains('Page Not Found').should('be.visible');
    });
  });
});
