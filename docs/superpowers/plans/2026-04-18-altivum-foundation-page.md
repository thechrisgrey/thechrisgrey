# The Altivum Foundation Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/foundation` pointer page for The Altivum Foundation to thechrisgrey.com, integrate it as the 7th tab on the home-page scroll summary and in the About dropdown, and ship SEO + sitemap coverage.

**Architecture:** Pointer-page pattern matching `/altivum` → `altivum.ai`. Single new page component (`Foundation.tsx`), three integration touch-points (routing, home scroll, nav dropdown), two utility extensions (schemas, sitemap), one new asset. No new tests (matches precedent for `/aws`, `/claude`, `/altivum`). Single commit at end per spec.

**Tech Stack:** React 19, TypeScript, React Router v6, Tailwind CSS, Vite, `react-helmet-async` for SEO.

**Spec:** `docs/superpowers/specs/2026-04-18-altivum-foundation-page-design.md`

---

## File inventory

**Create:**

- `src/pages/Foundation.tsx` — overwrites the pre-brainstorm draft with the spec's six-section layout
- `src/assets/foundation.jpg` — copied from foundation repo

**Modify:**

- `src/utils/schemas.ts` — add `foundationFAQs` + `buildFoundationOrganizationSchema`
- `src/pages/Home.tsx` — 7-tab `keyPoints`, section heights, clamp max
- `src/components/Navigation.tsx` — dropdown entry, transparency threshold
- `src/App.tsx` — lazy import + route
- `src/utils/routeManifest.ts` — prefetch entry
- `scripts/generate-sitemap.js` — static pages list

---

## Task 1: Copy hero image asset

**Files:**

- Create: `src/assets/foundation.jpg`
- Source: `~/Desktop/altivum-dev/altivum-foundation/src/assets/originals/heroes/taf1.jpeg`

- [ ] **Step 1: Copy the image**

```bash
cp ~/Desktop/altivum-dev/altivum-foundation/src/assets/originals/heroes/taf1.jpeg \
   /Users/cperez/Desktop/altivum-dev/thechrisgrey/src/assets/foundation.jpg
```

- [ ] **Step 2: Verify copy**

```bash
ls -lh /Users/cperez/Desktop/altivum-dev/thechrisgrey/src/assets/foundation.jpg
```

Expected: file exists, ~2.0 MB.

---

## Task 2: Extend `src/utils/schemas.ts`

**Files:**

- Modify: `src/utils/schemas.ts` (end of file, after `contactFAQs` export)

- [ ] **Step 1: Add `foundationFAQs` export**

Append to the end of `src/utils/schemas.ts`:

```typescript
export const foundationFAQs: FAQItem[] = [
  {
    question: 'What is The Altivum Foundation?',
    answer:
      'The Altivum Foundation is a 501(c)(3) nonprofit (EIN 41-4163272) founded by Christian Perez that funds U.S. military veterans pursuing education in cloud computing, artificial intelligence, robotics, and cybersecurity. Scholarships cover the full cost of certifications, degrees, and bootcamps, at no cost to the scholar.',
  },
  {
    question: 'Who is eligible for a scholarship?',
    answer:
      'Scholarships are for U.S. military veterans pursuing education in cloud computing, artificial intelligence, robotics, or cybersecurity. Full eligibility criteria and application details are available at altivumfoundation.org.',
  },
  {
    question: 'Is my donation tax-deductible?',
    answer:
      'Yes. The Altivum Foundation is a registered 501(c)(3) nonprofit (EIN 41-4163272), so contributions are tax-deductible to the extent allowed by law. Donations are accepted at altivumfoundation.org/give.',
  },
];
```

- [ ] **Step 2: Add `buildFoundationOrganizationSchema` export**

Append to the end of `src/utils/schemas.ts` (after `foundationFAQs`):

```typescript
/**
 * NonprofitOrganization schema for The Altivum Foundation
 */
export const buildFoundationOrganizationSchema = () => ({
  '@type': 'NonprofitOrganization',
  '@id': 'https://altivumfoundation.org/#organization',
  name: 'The Altivum Foundation',
  url: 'https://altivumfoundation.org',
  description:
    'A 501(c)(3) nonprofit funding U.S. military veterans pursuing education in cloud computing, artificial intelligence, and robotics — at no cost to the scholar.',
  taxID: '41-4163272',
  nonprofitStatus: 'Nonprofit501c3',
  founder: {
    '@id': `${SITE_URL}/#person`,
  },
  knowsAbout: ['Cloud Computing', 'Artificial Intelligence', 'Robotics', 'Cybersecurity', 'Veteran Education'],
  areaServed: {
    '@type': 'Country',
    name: 'United States',
  },
});
```

- [ ] **Step 3: Verify typecheck passes**

Run:

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: Overwrite `src/pages/Foundation.tsx`

**Files:**

- Modify: `src/pages/Foundation.tsx` (complete rewrite to match spec's six-section layout)

- [ ] **Step 1: Write the full file**

Overwrite `src/pages/Foundation.tsx` with:

```tsx
import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import foundationImage from '../assets/foundation.jpg';
import { typography } from '../utils/typography';
import { foundationFAQs, buildFoundationOrganizationSchema } from '../utils/schemas';

const FOCUS_AREAS = [
  {
    ordinal: '01',
    name: 'Cloud Computing',
    description:
      'Infrastructure and certification paths across AWS, Azure, and GCP — the operational backbone of the modern economy.',
  },
  {
    ordinal: '02',
    name: 'Artificial Intelligence',
    description:
      'Machine learning, large language models, and applied AI systems. The fields redefining every industry veterans enter.',
  },
  {
    ordinal: '03',
    name: 'Robotics',
    description:
      'Autonomous systems, industrial automation, and field logistics. The civilian discipline closest to operational military work.',
  },
  {
    ordinal: '04',
    name: 'Cybersecurity',
    description:
      'Threat analysis and defense operations. A field that rewards the exact instincts trained by years of service.',
  },
];

const Foundation = () => {
  return (
    <div className="min-h-screen bg-altivum-dark">
      <SEO
        title="The Altivum Foundation"
        description="The Altivum Foundation is a 501(c)(3) nonprofit funding U.S. military veterans pursuing education in cloud computing, artificial intelligence, and robotics — at no cost to the scholar."
        keywords="The Altivum Foundation, Altivum Foundation, veteran scholarships, 501c3, cloud computing education, AI education, robotics education, Christian Perez Founder"
        url="https://thechrisgrey.com/foundation"
        faq={foundationFAQs}
        breadcrumbs={[
          { name: 'Home', url: 'https://thechrisgrey.com' },
          { name: 'The Altivum Foundation', url: 'https://thechrisgrey.com/foundation' },
        ]}
        structuredData={[buildFoundationOrganizationSchema()]}
      />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden opacity-0 animate-fade-in">
        <div className="absolute inset-0">
          <img
            src={foundationImage}
            alt="Veterans pursuing education in technology"
            className="w-full h-full object-cover opacity-40"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-altivum-dark via-altivum-dark/80 to-altivum-dark/40" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-altivum-gold uppercase tracking-[0.3em] mb-4 sm:mb-6" style={typography.smallText}>
              The Altivum Foundation
            </p>
            <h1 className="text-white mb-6 sm:mb-8" style={typography.heroHeader}>
              Veteran scholarships in AI, Cloud &amp; Robotics.
            </h1>
            <div className="h-px w-16 bg-altivum-gold mx-auto mb-6 sm:mb-8" />
            <p className="text-altivum-silver max-w-2xl mx-auto mb-8 sm:mb-10" style={typography.subtitle}>
              A 501(c)(3) nonprofit funding U.S. military veterans pursuing education in the technologies defining the
              next economy. At no cost to the scholar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://altivumfoundation.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-4 bg-altivum-gold text-altivum-dark font-semibold rounded hover:bg-altivum-gold/90 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)] active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]"
              >
                Visit altivumfoundation.org
              </a>
              <a
                href="https://altivumfoundation.org/give"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-4 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]"
              >
                Give Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-altivum-gold uppercase tracking-[0.25em] mb-4" style={typography.smallText}>
            Our Vision
          </p>
          <h2 className="text-white mb-6" style={typography.sectionHeader}>
            The military trains the operators the AI economy is looking for.
          </h2>
          <div className="h-px w-16 bg-altivum-gold/60 mx-auto mb-8" />
          <p className="text-altivum-silver" style={typography.subtitle}>
            The men and women who served this country bring discipline, adaptability, and leadership forged under
            pressure. The industries shaping the next century — cloud computing, artificial intelligence, robotics —
            need exactly those qualities. The Altivum Foundation exists to connect the two.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 md:py-20 bg-altivum-navy/30 border-y border-altivum-slate/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center">
            <div>
              <p className="text-altivum-gold" style={typography.heroHeader}>
                200K+
              </p>
              <p className="text-altivum-silver mt-2" style={typography.bodyText}>
                Veterans transition out of service annually
              </p>
            </div>
            <div>
              <p className="text-altivum-gold" style={typography.heroHeader}>
                3.5M
              </p>
              <p className="text-altivum-silver mt-2" style={typography.bodyText}>
                Tech jobs unfilled in the United States
              </p>
            </div>
            <div>
              <p className="text-altivum-gold" style={typography.heroHeader}>
                $0
              </p>
              <p className="text-altivum-silver mt-2" style={typography.bodyText}>
                Cost to our scholars
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Focus Areas */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16 md:mb-20">
            <p className="text-altivum-gold uppercase tracking-[0.25em] mb-4" style={typography.smallText}>
              Eligible Paths
            </p>
            <h2 className="text-white mb-4" style={typography.sectionHeader}>
              Four fields. One common thread.
            </h2>
            <p className="text-altivum-silver max-w-2xl mx-auto" style={typography.subtitle}>
              Each rewards exactly the skills veterans already have.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {FOCUS_AREAS.map((area) => (
              <div
                key={area.ordinal}
                className="p-8 bg-altivum-navy/30 border border-altivum-slate/30 rounded-lg hover:border-altivum-gold/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-altivum-gold/5 transition-all duration-300 group"
              >
                <p className="text-altivum-gold/80 mb-3" style={typography.smallText}>
                  {area.ordinal}
                </p>
                <h3
                  className="text-white mb-4 group-hover:text-altivum-gold transition-colors"
                  style={typography.cardTitleLarge}
                >
                  {area.name}
                </h3>
                <p className="text-altivum-silver" style={typography.bodyText}>
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder tie-in */}
      <section className="py-24 md:py-32 bg-altivum-navy/10">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="border-l-4 border-altivum-gold pl-6 md:pl-8">
            <p className="text-altivum-gold uppercase tracking-[0.25em] mb-3" style={typography.smallText}>
              Founder &amp; President
            </p>
            <h2 className="text-white mb-6" style={typography.sectionHeader}>
              Why I built this.
            </h2>
            <div className="space-y-4">
              <p className="text-altivum-silver" style={typography.bodyText}>
                When I took off the uniform, the path from special operations to cloud architecture was not a roadmap.
                It was a lot of self-funded certifications, late nights, and the sense that a generation of proven
                leaders was being locked out of the industries that needed them most.
              </p>
              <p className="text-altivum-silver" style={typography.bodyText}>
                The Altivum Foundation exists because certification costs are prohibitive and training programs are
                fragmented. The veterans who can lead a team through a combat zone can lead an engineering team through
                a product launch — if someone gives them the technical foundation.
              </p>
              <p className="text-altivum-silver" style={typography.bodyText}>
                This is that foundation. A 501(c)(3) nonprofit (EIN 41-4163272) that funds the education at no cost to
                the scholar, with every contribution fully tax-deductible.
              </p>
            </div>
            <div className="mt-8">
              <Link
                to="/about"
                className="inline-flex items-center text-altivum-gold hover:text-altivum-gold/80 transition-colors group"
                style={typography.bodyText}
              >
                More about Christian
                <svg
                  className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 bg-gradient-to-br from-altivum-navy to-altivum-blue">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white mb-6" style={typography.sectionHeader}>
            Ready to invest in a veteran's future?
          </h2>
          <p className="text-altivum-silver mb-4" style={typography.subtitle}>
            Every contribution is tax-deductible.
          </p>
          <p className="text-altivum-silver/70 mb-10" style={typography.smallText}>
            501(c)(3) &middot; EIN 41-4163272
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://altivumfoundation.org/give"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full sm:w-auto px-8 py-4 bg-altivum-gold text-altivum-dark font-semibold rounded hover:bg-altivum-gold/90 hover:shadow-[0_0_20px_rgba(197,165,114,0.3)] active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]"
            >
              Give Now
            </a>
            <a
              href="https://altivumfoundation.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-altivum-gold text-altivum-gold font-semibold rounded hover:bg-altivum-gold/10 active:scale-[0.98] transition-all duration-300 touch-manipulation min-h-[48px]"
            >
              Visit altivumfoundation.org
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Foundation;
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npx tsc --noEmit
```

Expected: no errors. Note: this task alone may warn about unused `Foundation` import if routing isn't wired up yet — fine, Task 4 resolves it.

---

## Task 4: Wire up routing in `src/App.tsx`

**Files:**

- Modify: `src/App.tsx:26` (insert lazy import after `Claude`), `src/App.tsx:49` (insert route after `/altivum`)

- [ ] **Step 1: Add lazy import**

In `src/App.tsx`, find this line:

```tsx
const Altivum = lazy(() => import('./pages/Altivum'));
```

Insert this line immediately after it:

```tsx
const Foundation = lazy(() => import('./pages/Foundation'));
```

- [ ] **Step 2: Add route**

In `src/App.tsx`, find:

```tsx
<Route path="/altivum" element={<Altivum />} />
```

Insert this line immediately after it:

```tsx
<Route path="/foundation" element={<Foundation />} />
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Add prefetch entry in `src/utils/routeManifest.ts`

**Files:**

- Modify: `src/utils/routeManifest.ts:5`

- [ ] **Step 1: Insert prefetch entry**

In `src/utils/routeManifest.ts`, find:

```typescript
['/altivum', () => import('../pages/Altivum')],
```

Insert this line immediately after it:

```typescript
['/foundation', () => import('../pages/Foundation')],
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Update home page scroll (`src/pages/Home.tsx`)

**Files:**

- Modify: `src/pages/Home.tsx:34` (clamp max), `src/pages/Home.tsx:46-53` (keyPoints array), `src/pages/Home.tsx:92` (section height)

- [ ] **Step 1: Add 7th keyPoint**

In `src/pages/Home.tsx`, find:

```tsx
const keyPoints = [
  { title: 'Personal Biography', subtitle: 'Christian Perez', link: '/about' },
  { title: 'Altivum Inc', subtitle: 'Founder & CEO', link: '/altivum' },
  { title: 'The Vector Podcast', subtitle: 'Host', link: '/podcast' },
  { title: 'Beyond the Assessment', subtitle: 'Author', link: '/beyond-the-assessment' },
  { title: 'Amazon Web Services', subtitle: 'AWS Community Builder (AI Engineering)', link: '/aws' },
  { title: 'Claude', subtitle: 'Applied AI Engineer', link: '/claude' },
];
```

Replace with:

```tsx
const keyPoints = [
  { title: 'Personal Biography', subtitle: 'Christian Perez', link: '/about' },
  { title: 'Altivum Inc', subtitle: 'Founder & CEO', link: '/altivum' },
  { title: 'The Altivum Foundation', subtitle: 'Founder & President', link: '/foundation' },
  { title: 'The Vector Podcast', subtitle: 'Host', link: '/podcast' },
  { title: 'Beyond the Assessment', subtitle: 'Author', link: '/beyond-the-assessment' },
  { title: 'Amazon Web Services', subtitle: 'AWS Community Builder (AI Engineering)', link: '/aws' },
  { title: 'Claude', subtitle: 'Applied AI Engineer', link: '/claude' },
];
```

- [ ] **Step 2: Bump scroll-progress clamp from 5 to 6**

In `src/pages/Home.tsx`, find:

```tsx
const progress = Math.min(Math.floor((scrollPosition - windowHeight) / (windowHeight * scrollInterval)), 5);
```

Replace with:

```tsx
const progress = Math.min(Math.floor((scrollPosition - windowHeight) / (windowHeight * scrollInterval)), 6);
```

- [ ] **Step 3: Extend sticky section height**

In `src/pages/Home.tsx`, find:

```tsx
      <section className="relative h-[575vh] md:h-[680vh]">
```

Replace with:

```tsx
      <section className="relative h-[625vh] md:h-[760vh]">
```

- [ ] **Step 4: Verify typecheck passes**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npx tsc --noEmit
```

Expected: no errors.

---

## Task 7: Update Navigation (`src/components/Navigation.tsx`)

**Files:**

- Modify: `src/components/Navigation.tsx:15-22` (dropdown array), `src/components/Navigation.tsx:36` (transparency threshold)

- [ ] **Step 1: Insert Foundation into dropdown array**

In `src/components/Navigation.tsx`, find:

```tsx
const ABOUT_DROPDOWN_ITEMS = [
  { path: '/about', label: 'Personal Biography' },
  { path: '/altivum', label: 'Altivum Inc' },
  { path: '/podcast', label: 'The Vector Podcast' },
  { path: '/beyond-the-assessment', label: 'Beyond the Assessment' },
  { path: '/aws', label: 'Amazon Web Services' },
  { path: '/claude', label: 'Claude' },
];
```

Replace with:

```tsx
const ABOUT_DROPDOWN_ITEMS = [
  { path: '/about', label: 'Personal Biography' },
  { path: '/altivum', label: 'Altivum Inc' },
  { path: '/foundation', label: 'The Altivum Foundation' },
  { path: '/podcast', label: 'The Vector Podcast' },
  { path: '/beyond-the-assessment', label: 'Beyond the Assessment' },
  { path: '/aws', label: 'Amazon Web Services' },
  { path: '/claude', label: 'Claude' },
];
```

- [ ] **Step 2: Bump home-page transparency threshold from 8 to 9**

In `src/components/Navigation.tsx`, find:

```tsx
const summaryEndPosition = window.innerHeight * 8;
```

Replace with:

```tsx
const summaryEndPosition = window.innerHeight * 9;
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npx tsc --noEmit
```

Expected: no errors.

---

## Task 8: Update sitemap (`scripts/generate-sitemap.js`)

**Files:**

- Modify: `scripts/generate-sitemap.js:24-35`

- [ ] **Step 1: Add `/foundation` to staticPages**

In `scripts/generate-sitemap.js`, find:

```javascript
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/about', priority: '0.8', changefreq: 'monthly' },
  { url: '/altivum', priority: '0.9', changefreq: 'weekly' },
  { url: '/podcast', priority: '0.8', changefreq: 'weekly' },
  { url: '/blog', priority: '0.8', changefreq: 'weekly' },
  { url: '/contact', priority: '0.7', changefreq: 'monthly' },
  { url: '/links', priority: '0.7', changefreq: 'monthly' },
  { url: '/beyond-the-assessment', priority: '0.7', changefreq: 'monthly' },
  { url: '/chat', priority: '0.7', changefreq: 'weekly' },
  { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
];
```

Replace with:

```javascript
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/about', priority: '0.8', changefreq: 'monthly' },
  { url: '/altivum', priority: '0.9', changefreq: 'weekly' },
  { url: '/foundation', priority: '0.9', changefreq: 'weekly' },
  { url: '/podcast', priority: '0.8', changefreq: 'weekly' },
  { url: '/blog', priority: '0.8', changefreq: 'weekly' },
  { url: '/contact', priority: '0.7', changefreq: 'monthly' },
  { url: '/links', priority: '0.7', changefreq: 'monthly' },
  { url: '/beyond-the-assessment', priority: '0.7', changefreq: 'monthly' },
  { url: '/chat', priority: '0.7', changefreq: 'weekly' },
  { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
];
```

---

## Task 9: Lint + build verification

**Files:** none modified; full-repo verification only.

- [ ] **Step 1: Run lint**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npm run lint
```

Expected: no errors, no warnings.

- [ ] **Step 2: Run full build**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npm run build
```

Expected: build succeeds. Look for:

- Podcast episodes step completes
- TypeScript compile step completes with no errors
- Vite build emits a `Foundation-[hash].js` chunk in the output
- Sitemap step logs `Total URLs: 11 static + N blog posts` (was 10 before)

- [ ] **Step 3: Confirm `/foundation` in sitemap**

```bash
grep -c foundation /Users/cperez/Desktop/altivum-dev/thechrisgrey/dist/sitemap.xml
```

Expected: `1` (one line matches: `<loc>https://thechrisgrey.com/foundation</loc>`).

---

## Task 10: Manual visual verification (dev server)

**Files:** none modified; interactive verification only.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && npm run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 2: Verify home page scroll**

At desktop width (≥768px):

- Scroll slowly from the hero down through the sticky section.
- Seven tabs should appear in order: Personal Biography → Altivum Inc → The Altivum Foundation → The Vector Podcast → Beyond the Assessment → Amazon Web Services → Claude.
- The nav should stay transparent through the entire sticky section.
- The nav should become solid (navy with shadow) somewhere inside the "Let's Connect" CTA section.

Resize to mobile width (<768px):

- Same seven tabs appear; pacing should feel similar to before (reveals every 50vh).

- [ ] **Step 3: Verify About dropdown**

Desktop: click "About" in nav. Dropdown should show 7 items with "The Altivum Foundation" between "Altivum Inc" and "The Vector Podcast".
Keyboard test: with the dropdown open, press Down arrow through all 7 items, then Up arrow back up; press Escape to close.

Mobile: open the hamburger menu. Under the "About" section, the same 7 items should appear inline.

- [ ] **Step 4: Verify `/foundation` page**

Navigate to `http://localhost:5173/foundation`:

- Hero image loads and is darkened; "The Altivum Foundation" kicker + "Veteran scholarships in AI, Cloud & Robotics." headline render.
- Click "Visit altivumfoundation.org" — opens altivumfoundation.org in new tab.
- Click "Give Now" — opens altivumfoundation.org/give in new tab.
- Scroll through: Vision section → Stats band (200K+/3.5M/$0) → Focus Areas grid (4 cards) → Founder tie-in section → CTA band.
- Click "More about Christian →" at bottom of founder section — navigates to `/about`.
- In CTA band, both buttons open altivumfoundation.org URLs in new tabs.

- [ ] **Step 5: Stop dev server**

```
Ctrl-C in the terminal running `npm run dev`
```

---

## Task 11: Commit and push

**Files:** all changes from Tasks 1–8.

- [ ] **Step 1: Review changed files**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && git status
```

Expected: 7 files to commit:

- New: `src/assets/foundation.jpg`
- New: `src/pages/Foundation.tsx`
- Modified: `src/utils/schemas.ts`
- Modified: `src/pages/Home.tsx`
- Modified: `src/components/Navigation.tsx`
- Modified: `src/App.tsx`
- Modified: `src/utils/routeManifest.ts`
- Modified: `scripts/generate-sitemap.js`

- [ ] **Step 2: Stage the changes**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && git add \
  src/assets/foundation.jpg \
  src/pages/Foundation.tsx \
  src/utils/schemas.ts \
  src/pages/Home.tsx \
  src/components/Navigation.tsx \
  src/App.tsx \
  src/utils/routeManifest.ts \
  scripts/generate-sitemap.js
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && git commit -m "$(cat <<'EOF'
feat(foundation): add /foundation pointer page and home tab

Introduces a 7th pillar on thechrisgrey.com for The Altivum Foundation
(501(c)(3) EIN 41-4163272). Follows the existing /altivum → altivum.ai
pointer pattern: short curated intro with all deep CTAs linking to
altivumfoundation.org.

- Foundation.tsx: 6-section layout (hero, vision, stats, focus areas,
  founder tie-in, CTA band)
- Home.tsx: 7-tab sticky summary with preserved per-tab pacing
  (heights 625vh/760vh, clamp max 6)
- Navigation.tsx: dropdown entry between Altivum Inc and Vector Podcast;
  transparency threshold bumped to 9*innerHeight
- schemas.ts: foundationFAQs + NonprofitOrganization JSON-LD
- sitemap + route manifest + App routing updated

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify commit**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && git log --oneline -5
```

Expected: most recent commit is `feat(foundation): add /foundation pointer page and home tab`.

- [ ] **Step 5: Push to origin/main**

```bash
cd /Users/cperez/Desktop/altivum-dev/thechrisgrey && git push origin main
```

Expected: push succeeds; Amplify will pick up the new commit on `main` and trigger a deploy.
