describe('Blog Listing Page', () => {
  beforeEach(() => {
    // Intercept Sanity CDN calls with fixture data (avoids real API dependency)
    cy.fixture('blog-posts.json').then((blogData) => {
      cy.intercept('GET', '**/k5950b3w**sanity.io/**', {
        statusCode: 200,
        body: { result: blogData },
      }).as('sanityFetch');
    });

    cy.visit('/blog');
    cy.wait('@sanityFetch');
  });

  it('should load the blog page successfully', () => {
    cy.url().should('include', '/blog');
  });

  it('should display the page heading', () => {
    cy.contains('h1', 'Essays & Reflections').should('be.visible');
  });

  it('should have correct SEO meta tags', () => {
    cy.verifySEO('Blog');
  });

  it('should display blog posts after loading', () => {
    cy.get('article').should('have.length', 4);
  });

  it('should display post titles and excerpts', () => {
    cy.contains('Leadership Lessons from Special Operations').should('be.visible');
    cy.contains('Building AI Systems That Serve Veterans').should('be.visible');
  });

  it('should display category labels on post cards', () => {
    cy.contains('Leadership').should('be.visible');
    cy.contains('Technology').should('be.visible');
  });

  it('should display reading time on posts that have it', () => {
    cy.contains('8 min read').should('exist');
    cy.contains('12 min read').should('exist');
  });

  it('should mark featured posts with a Featured badge', () => {
    cy.contains('Featured').should('exist');
  });

  it('should display category filter buttons', () => {
    cy.contains('button', 'All').should('be.visible');
    cy.contains('button', 'Leadership').should('be.visible');
    cy.contains('button', 'Technology').should('be.visible');
    cy.contains('button', 'Philosophy').should('be.visible');
  });

  it('should filter posts by category when a category button is clicked', () => {
    cy.contains('button', 'Technology').click();

    // URL should update with category param
    cy.url().should('include', 'category=Technology');

    // Only Technology posts should be visible
    cy.contains('Building AI Systems That Serve Veterans').should('be.visible');
    cy.contains('Cloud Architecture for Startups').should('be.visible');

    // Leadership post should not be visible
    cy.contains('Leadership Lessons from Special Operations').should('not.exist');
  });

  it('should show active filter chips when filters are applied', () => {
    cy.contains('button', 'Technology').click();

    cy.contains('Active filters:').should('be.visible');
    cy.contains('Technology').should('be.visible');
  });

  it('should clear filters when clicking Clear all', () => {
    cy.contains('button', 'Technology').click();
    cy.contains('Clear all').click();

    cy.url().should('not.include', 'category=');
    cy.get('article').should('have.length', 4);
  });

  it('should have a search input', () => {
    cy.get('input[placeholder="Search articles..."]').should('be.visible');
  });

  it('should filter posts by search query', () => {
    cy.get('input[placeholder="Search articles..."]').type('AI');

    cy.url().should('include', 'q=AI');
    cy.contains('Building AI Systems That Serve Veterans').should('be.visible');
  });

  it('should display a Read Article link on each post card', () => {
    cy.contains('Read Article').should('be.visible');
  });

  it('should navigate to a blog post when clicking on a post card', () => {
    // Set up a second intercept for the individual post detail query
    // so the app receives the correct data shape after navigation
    cy.fixture('blog-post-detail.json').then((postDetail) => {
      cy.intercept('GET', '**/k5950b3w**sanity.io/**', {
        statusCode: 200,
        body: { result: postDetail },
      }).as('sanityPostDetail');
    });

    cy.contains('Leadership Lessons from Special Operations').click();
    cy.url().should('include', '/blog/leadership-lessons-special-operations');
    cy.wait('@sanityPostDetail');
    cy.get('h1', { timeout: 10000 }).should('be.visible');
  });

  it('should display the navigation bar', () => {
    cy.verifyNavigation();
  });

  it('should display the footer', () => {
    cy.verifyFooter();
  });

  it('should show "No posts match your filters" when search has no results', () => {
    cy.get('input[placeholder="Search articles..."]').type('xyzzy12345nonexistent');
    cy.contains('No posts match your filters').should('be.visible');
  });

  it('should be responsive on mobile viewport', () => {
    cy.viewport('iphone-x');
    cy.contains('h1', 'Essays & Reflections').should('be.visible');
    cy.get('input[placeholder="Search articles..."]').should('be.visible');
  });
});

describe('Blog Listing - Error State', () => {
  it('should display an error message when Sanity API fails', () => {
    cy.intercept('GET', '**/k5950b3w**sanity.io/**', {
      statusCode: 500,
      body: 'Server Error',
    }).as('sanityError');

    cy.visit('/blog');
    cy.wait('@sanityError');

    cy.contains('Unable to load posts').should('be.visible');
    cy.contains('Try Again').should('be.visible');
  });
});
