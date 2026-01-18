# Privacy Policy Implementation Plan

**Created:** January 18, 2026
**Completed:** January 18, 2026
**Status:** Complete
**Priority:** High
**Effort:** Low (~30 minutes)

---

## Overview

Add a Privacy Policy page to thechrisgrey.com to comply with GDPR/CCPA requirements. The site collects user data through contact forms, newsletter signup, and AI chat interactions.

---

## Progress Tracker

| # | Task | Status | Effort |
|---|------|--------|--------|
| 1 | Create Privacy.tsx page component | [x] Complete | 15 min |
| 2 | Add /privacy route to App.tsx | [x] Complete | 2 min |
| 3 | Add Privacy link to Footer.tsx | [x] Complete | 5 min |
| 4 | Add /privacy to sitemap generator | [x] Complete | 2 min |
| 5 | Verify and test | [x] Complete | 5 min |

---

## Detailed Implementation

### Task 1: Create Privacy.tsx Page Component

**File:** `src/pages/Privacy.tsx`

**Structure:**
- Hero section with title "Privacy Policy"
- Last updated date
- Organized sections covering all data practices
- Match existing page styling (typography, colors)

**Content Sections:**

1. **Introduction**
   - Site owner: Christian Perez / Altivum Inc.
   - Commitment to privacy

2. **Information We Collect**
   - Contact form: name, email, subject, message
   - Newsletter: email address
   - AI Chat: conversation messages (not stored permanently)
   - Automatic: IP address, browser type, device info (standard web logs)

3. **How We Use Your Information**
   - Respond to inquiries
   - Send newsletter updates (if subscribed)
   - Provide AI chat responses
   - Improve website functionality

4. **Third-Party Services**
   - **AWS (Amazon Web Services):** Hosting, Lambda functions, Bedrock AI
   - **Sanity.io:** Content management for blog
   - **AWS Amplify:** Website hosting and deployment
   - **Amazon Bedrock:** AI chat processing (Claude model)

5. **Cookies & Tracking**
   - Minimal cookie usage
   - No third-party advertising trackers
   - Essential cookies only (if any)

6. **Data Retention**
   - Contact form submissions: retained for business purposes
   - Newsletter: until unsubscribe
   - AI chat: not permanently stored

7. **Your Rights**
   - Access your data
   - Request deletion
   - Opt-out of communications
   - GDPR/CCPA rights

8. **Data Security**
   - HTTPS encryption
   - AWS security practices
   - No selling of personal data

9. **Children's Privacy**
   - Site not intended for children under 13

10. **Changes to Policy**
    - Notification of updates
    - Last updated date

11. **Contact Information**
    - Email: christian.perez@altivum.ai
    - Link to contact page

**Component Pattern:**
```tsx
import { SEO } from '../components/SEO';
import { typography } from '../utils/typography';

const Privacy = () => {
  return (
    <div className="min-h-screen pt-20">
      <SEO
        title="Privacy Policy"
        description="Privacy policy for thechrisgrey.com - how we collect, use, and protect your personal information."
        url="https://thechrisgrey.com/privacy"
        breadcrumbs={[
          { name: "Home", url: "https://thechrisgrey.com" },
          { name: "Privacy Policy", url: "https://thechrisgrey.com/privacy" }
        ]}
      />

      {/* Hero Section */}
      <section className="py-32 bg-altivum-dark">
        {/* Title and last updated date */}
      </section>

      {/* Policy Content */}
      <section className="py-24 bg-altivum-dark">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          {/* Organized sections */}
        </div>
      </section>
    </div>
  );
};

export default Privacy;
```

**Styling Notes:**
- Use `typography.sectionHeader` for section headings
- Use `typography.bodyText` for paragraph content
- Use `typography.cardTitleSmall` for subsection headings
- Consistent spacing: `space-y-8` between sections
- Gold accent for section numbers/icons (optional)

---

### Task 2: Add Route to App.tsx

**File:** `src/App.tsx`

**Changes:**
1. Import Privacy component
2. Add Route for /privacy

```tsx
// Add import
import Privacy from './pages/Privacy';

// Add route (after /chat)
<Route path="/privacy" element={<Privacy />} />
```

---

### Task 3: Add Privacy Link to Footer

**File:** `src/components/Footer.tsx`

**Changes:**
Add "Privacy Policy" link in the copyright section at the bottom, separated by a dot or pipe.

**Current (line 90-94):**
```tsx
<div className="mt-4 sm:mt-6 md:mt-4 pt-3 sm:pt-4 border-t border-altivum-slate/30">
  <p className="text-center text-altivum-silver" style={typography.smallText}>
    &copy; {currentYear} Christian Perez. All rights reserved.
  </p>
</div>
```

**Updated:**
```tsx
<div className="mt-4 sm:mt-6 md:mt-4 pt-3 sm:pt-4 border-t border-altivum-slate/30">
  <p className="text-center text-altivum-silver" style={typography.smallText}>
    &copy; {currentYear} Christian Perez. All rights reserved.
    <span className="mx-2">·</span>
    <Link to="/privacy" className="hover:text-altivum-gold transition-colors">
      Privacy Policy
    </Link>
  </p>
</div>
```

---

### Task 4: Add to Sitemap Generator

**File:** `scripts/generate-sitemap.js`

**Changes:**
Add /privacy to staticPages array with appropriate priority.

```javascript
{ url: '/privacy', priority: '0.3', changefreq: 'yearly' },
```

Place after /chat in the array. Low priority (0.3) since it's a utility page, and yearly changefreq since it rarely updates.

---

### Task 5: Verify and Test

**Checklist:**
- [ ] Build completes without errors (`npm run build`)
- [ ] Page accessible at /privacy
- [ ] All sections render correctly
- [ ] Footer link works
- [ ] Sitemap includes /privacy URL
- [ ] SEO meta tags present
- [ ] Responsive design works on mobile
- [ ] Typography consistent with rest of site

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/pages/Privacy.tsx` | New file - Privacy Policy page |
| `src/App.tsx` | Import + Route for /privacy |
| `src/components/Footer.tsx` | Add Privacy Policy link |
| `scripts/generate-sitemap.js` | Add /privacy to static pages |

---

## Legal Notes

This privacy policy is for a personal/small business website. For complex business operations or specific legal requirements, consult with a legal professional.

Key compliance considerations:
- **GDPR (EU):** Right to access, deletion, data portability
- **CCPA (California):** Right to know, delete, opt-out of sale
- **General:** Clear disclosure of data practices, contact method for inquiries

---

## Post-Implementation

After deployment:
- Update ideas-to-consider.md to mark as complete
- Consider adding Google Analytics privacy disclosure if analytics added in future
- Review annually for accuracy
