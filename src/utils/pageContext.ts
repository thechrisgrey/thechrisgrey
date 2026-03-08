export interface PageContext {
  currentPage: string;
  pageTitle: string;
  section: string;
  visitedPages: string[];
}

interface RouteMetadata {
  pageTitle: string;
  section: string;
}

const ROUTE_CONTEXT_MAP: Record<string, RouteMetadata> = {
  '/': { pageTitle: 'Home', section: 'Home' },
  '/about': { pageTitle: 'Personal Biography', section: 'Personal Biography' },
  '/altivum': { pageTitle: 'Altivum Inc', section: 'Altivum Inc' },
  '/podcast': { pageTitle: 'The Vector Podcast', section: 'The Vector Podcast' },
  '/beyond-the-assessment': { pageTitle: 'Beyond the Assessment', section: 'Beyond the Assessment' },
  '/aws': { pageTitle: 'Amazon Web Services', section: 'Amazon Web Services' },
  '/claude': { pageTitle: 'Claude', section: 'Claude' },
  '/blog': { pageTitle: 'Blog', section: 'Blog' },
  '/contact': { pageTitle: 'Contact & Speaking', section: 'Contact & Speaking' },
  '/links': { pageTitle: 'Links', section: 'Links' },
  '/chat': { pageTitle: 'AI Chat', section: 'AI Chat' },
  '/privacy': { pageTitle: 'Privacy Policy', section: 'Privacy Policy' },
  '/admin': { pageTitle: 'Admin', section: 'Admin' },
};

const DEFAULT_SUGGESTIONS = [
  "How did he go from Green Beret to tech CEO?",
  "What drives Altivum's mission?",
  "Why did he write Beyond the Assessment?",
  "What's his take on AI and veterans?",
];

export const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/': [
    "What's Christian's story?",
    "What is Altivum?",
    "Tell me about the podcast",
    "What's Beyond the Assessment about?",
  ],
  '/about': [
    "What was his military career like?",
    "Where did he go to school?",
    "What's his leadership philosophy?",
    "How did he transition to tech?",
  ],
  '/altivum': [
    "What does Altivum do?",
    "What is Altivum Logic?",
    "What's Vanguard?",
    "How is Altivum different?",
  ],
  '/podcast': [
    "What's the podcast about?",
    "Who are some notable guests?",
    "What topics does it cover?",
    "How can I listen?",
  ],
  '/beyond-the-assessment': [
    "What's the book about?",
    "Who should read it?",
    "What inspired him to write it?",
    "Where can I buy it?",
  ],
  '/aws': [
    "What does he do as an AWS Community Builder?",
    "What AWS services does he work with?",
    "How does he use AI on AWS?",
    "What is the Community Builder program?",
  ],
  '/claude': [
    "How does he use Claude in production?",
    "What Anthropic Academy certifications does he have?",
    "How does he combine Claude with AWS?",
    "What AI systems has he built with Claude?",
  ],
  '/blog': [
    "What does he write about?",
    "Any posts on AI strategy?",
    "What are the most popular posts?",
    "Does he have a blog series?",
  ],
  '/contact': [
    "What topics does he speak on?",
    "How do I book him for an event?",
    "What's in the press kit?",
    "How can I reach him?",
  ],
  '/links': [
    "Where can I follow him?",
    "What platforms is he on?",
    "What's Altivum's website?",
    "Where's the podcast?",
  ],
};

export function getPageContext(pathname: string, visitedPages: string[]): PageContext {
  // Handle /blog/:slug routes
  const isBlogPost = pathname.startsWith('/blog/') && pathname !== '/blog';
  const lookupKey = isBlogPost ? '/blog/:slug' : pathname;

  const metadata = ROUTE_CONTEXT_MAP[lookupKey] || ROUTE_CONTEXT_MAP[pathname] || {
    pageTitle: 'Page',
    section: 'General',
  };

  // For blog posts, include the slug in the section
  const section = isBlogPost
    ? `Blog Post (${pathname.replace('/blog/', '')})`
    : metadata.section;

  return {
    currentPage: pathname,
    pageTitle: isBlogPost ? 'Blog Post' : metadata.pageTitle,
    section,
    visitedPages,
  };
}

export function getSuggestionsForPage(pathname: string): string[] {
  // Blog post pages use blog suggestions
  if (pathname.startsWith('/blog/') && pathname !== '/blog') {
    return [
      "Can you summarize this post?",
      "What else has he written on this topic?",
      "What's his take on this?",
      "Any related podcast episodes?",
    ];
  }

  return PAGE_SUGGESTIONS[pathname] || DEFAULT_SUGGESTIONS;
}
