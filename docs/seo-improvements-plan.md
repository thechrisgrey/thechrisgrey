# SEO Improvements Implementation Plan

**Created:** January 18, 2026
**Completed:** January 18, 2026
**Status:** Complete
**Overall Goal:** Enhance SEO and AEO capabilities from A- to A+ grade

---

## Progress Tracker

| # | Task | Priority | Status | Effort |
|---|------|----------|--------|--------|
| 1 | Add `/chat` to sitemap | High | [x] Complete | 5 min |
| 2 | Add `noindex` prop to SEO component | High | [x] Complete | 10 min |
| 3 | Apply `noindex` to 404 states | High | [x] Complete | 5 min |
| 4 | Add article-specific OG tags | Medium | [x] Complete | 20 min |
| 5 | Add hreflang tags | Low | [x] Complete | 10 min |
| 6 | Add wordCount to BlogPosting schema | Low | [x] Complete | 15 min |
| 7 | Verify and test all changes | High | [x] Complete | 15 min |

**Actual Total Time:** ~30 minutes

---

## Detailed Implementation Steps

### Task 1: Add `/chat` to Sitemap

**File:** `scripts/generate-sitemap.js`

**Current State:** The `/chat` route exists in the app but is not included in the sitemap's static pages array.

**Implementation:**
1. Open `scripts/generate-sitemap.js`
2. Add the chat page to the `staticPages` array after `/beyond-the-assessment`:
   ```javascript
   { url: '/chat', priority: '0.7', changefreq: 'weekly' },
   ```

**Verification:**
- Run `npm run build`
- Check `dist/sitemap.xml` contains the `/chat` URL

---

### Task 2: Add `noindex` Prop to SEO Component

**File:** `src/components/SEO.tsx`

**Current State:** The SEO component doesn't support a `noindex` prop for pages that shouldn't be indexed (404 pages, search results, etc.).

**Implementation:**
1. Add `noindex` to the `SEOProps` interface:
   ```typescript
   interface SEOProps {
     title: string;
     description: string;
     keywords?: string;
     image?: string;
     url?: string;
     type?: 'website' | 'article' | 'profile' | 'book';
     breadcrumbs?: BreadcrumbItem[];
     faq?: FAQItem[];
     noindex?: boolean;  // NEW
     datePublished?: string;  // NEW - for article OG tags
     dateModified?: string;   // NEW - for article OG tags
   }
   ```

2. Add conditional robots meta tag inside the `<Helmet>` component:
   ```tsx
   {noindex && (
     <meta name="robots" content="noindex, nofollow" />
   )}
   ```

**Verification:**
- Build passes without TypeScript errors
- Test by temporarily adding `noindex={true}` to a page and inspecting the HTML

---

### Task 3: Apply `noindex` to 404 States

**Files:**
- `src/pages/BlogPost.tsx` (404 state for missing posts)

**Current State:** The 404 state in BlogPost.tsx renders SEO tags but doesn't prevent indexing.

**Implementation:**
1. In `BlogPost.tsx`, update the 404 SEO component (around line 97):
   ```tsx
   <SEO
     title="Article Not Found"
     description="The article you're looking for doesn't exist or has been moved."
     url={`https://thechrisgrey.com/blog/${slug}`}
     noindex={true}
   />
   ```

**Verification:**
- Navigate to a non-existent blog post URL
- Inspect page source for `<meta name="robots" content="noindex, nofollow" />`

---

### Task 4: Add Article-Specific OG Tags

**File:** `src/components/SEO.tsx`

**Current State:** Blog posts don't include `article:published_time`, `article:modified_time`, or `article:author` OG tags.

**Implementation:**
1. Update the SEOProps interface to include `datePublished` and `dateModified` (if not already done in Task 2)

2. Add article-specific OG tags inside `<Helmet>`, after the existing OG tags:
   ```tsx
   {/* Article-specific Open Graph tags */}
   {type === 'article' && datePublished && (
     <meta property="article:published_time" content={datePublished} />
   )}
   {type === 'article' && dateModified && (
     <meta property="article:modified_time" content={dateModified} />
   )}
   {type === 'article' && (
     <>
       <meta property="article:author" content="https://thechrisgrey.com/about" />
       <meta property="article:section" content="Technology" />
     </>
   )}
   ```

3. Update `BlogPost.tsx` to pass the new props (around line 126):
   ```tsx
   <SEO
     title={post.seoTitle || post.title}
     description={post.seoDescription || post.excerpt}
     image={post.image?.asset ? urlFor(post.image).width(1200).height(630).auto('format').quality(85).url() : undefined}
     url={shareUrl}
     type="article"
     datePublished={post.publishedAt}
     dateModified={post._updatedAt || post.publishedAt}
     breadcrumbs={[...]}
     structuredData={[...]}
   />
   ```

**Verification:**
- Navigate to a blog post
- Inspect page source for `article:published_time` and `article:author` meta tags
- Test with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)

---

### Task 5: Add hreflang Tags

**File:** `src/components/SEO.tsx`

**Current State:** No hreflang tags present. While the site is English-only, explicit hreflang helps search engines understand language targeting.

**Implementation:**
1. Add hreflang link tags inside `<Helmet>`, after the canonical link:
   ```tsx
   <link rel="canonical" href={url} />
   <link rel="alternate" hreflang="en-US" href={url} />
   <link rel="alternate" hreflang="x-default" href={url} />
   ```

**Verification:**
- Inspect any page's source for hreflang link tags
- Validate with [Google Search Console](https://search.google.com/search-console)

---

### Task 6: Add wordCount to BlogPosting Schema

**File:** `src/pages/BlogPost.tsx`

**Current State:** The BlogPosting structured data doesn't include `wordCount`, which is a recommended property for article schemas.

**Implementation:**
1. Create a utility function to extract text and count words from Portable Text:
   ```typescript
   // Add at the top of BlogPost.tsx or in a utility file
   const getWordCount = (body: any[]): number => {
     if (!body) return 0;

     const extractText = (blocks: any[]): string => {
       return blocks
         .filter(block => block._type === 'block')
         .map(block => {
           if (block.children) {
             return block.children
               .filter((child: any) => child._type === 'span')
               .map((span: any) => span.text || '')
               .join('');
           }
           return '';
         })
         .join(' ');
     };

     const text = extractText(body);
     return text.split(/\s+/).filter(word => word.length > 0).length;
   };
   ```

2. Update the BlogPosting structured data to include wordCount:
   ```tsx
   structuredData={[
     {
       "@type": "BlogPosting",
       "@id": `${shareUrl}/#article`,
       "headline": post.title,
       "description": post.excerpt,
       "datePublished": post.publishedAt,
       "dateModified": post._updatedAt || post.publishedAt,
       "wordCount": post.body ? getWordCount(post.body) : undefined,  // NEW
       "author": {...},
       // ... rest of schema
     }
   ]}
   ```

**Verification:**
- Navigate to a blog post
- Inspect page source for `"wordCount":` in the JSON-LD script
- Validate with [Google Rich Results Test](https://search.google.com/test/rich-results)

---

### Task 7: Verify and Test All Changes

**Tools:**
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- Browser DevTools (inspect page source)

**Verification Checklist:**
- [ ] Build completes without errors (`npm run build`)
- [ ] Sitemap includes `/chat` URL
- [ ] 404 pages have `noindex` meta tag
- [ ] Blog posts have `article:published_time` OG tag
- [ ] All pages have hreflang tags
- [ ] Blog posts have `wordCount` in JSON-LD
- [ ] Rich Results Test passes for homepage
- [ ] Rich Results Test passes for blog post
- [ ] No console errors on any page

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `scripts/generate-sitemap.js` | Add `/chat` to static pages |
| `src/components/SEO.tsx` | Add `noindex`, `datePublished`, `dateModified` props; add article OG tags; add hreflang tags |
| `src/pages/BlogPost.tsx` | Add `noindex` to 404 state; pass date props to SEO; add wordCount to schema |

---

## Future Considerations (Out of Scope)

These items were identified but are not part of this implementation plan:

1. **Pre-rendering / SSR Migration** - Would require migrating to Next.js or similar framework. Major architectural change.

2. **Speakable Schema** - Could mark certain content as speakable for voice search. Consider for future AEO enhancements.

3. **Video Schema** - If video content is added (podcast video clips), add VideoObject schema.

4. **Local Business Schema** - If physical location becomes relevant, add LocalBusiness schema.

---

## Completion Criteria

This plan is complete when:
1. All 7 tasks are marked as complete
2. All verification steps pass
3. Changes are deployed to production
4. Google Search Console shows no new errors after 1 week

---

## Notes

- Keep this document updated as tasks are completed
- Test on staging/preview before merging to main
- After deployment, monitor Google Search Console for any issues
