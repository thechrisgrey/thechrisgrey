# Implementation Plan: Reading Progress Bar & security.txt

## Overview

Two low-effort enhancements to improve user experience and professionalism.

---

## Task 1: Reading Progress Bar

### Description

A thin horizontal bar at the top of blog posts that fills from left to right as the user scrolls, providing visual feedback on reading progress.

### Design Specs

- **Position:** Fixed at top of viewport (below navigation)
- **Height:** 3px
- **Color:** `altivum-gold` (#C5A572)
- **Background:** Transparent (or subtle dark)
- **Width:** 0% at top, 100% at bottom of article
- **Z-index:** Below nav but above content

### Implementation Steps

1. **Create `ReadingProgressBar` component** (`src/components/ReadingProgressBar.tsx`)
   - Track scroll position with `useState` and `useEffect`
   - Calculate progress: `(scrollY / (documentHeight - windowHeight)) * 100`
   - Render fixed-position div with dynamic width
   - Use `will-change: width` for performance

2. **Add to `BlogPost.tsx`**
   - Import and render `<ReadingProgressBar />` at top of component
   - Only shows on individual blog post pages

### Code Structure

```tsx
// ReadingProgressBar.tsx
- useState for progress (0-100)
- useEffect with scroll listener
- Cleanup on unmount
- Return fixed div with width based on progress
```

### Files to Create/Modify

- `src/components/ReadingProgressBar.tsx` (create)
- `src/pages/BlogPost.tsx` (add component)

---

## Task 2: security.txt File

### Description

A standardized file that tells security researchers how to report vulnerabilities. Located at `/.well-known/security.txt` per RFC 9116.

### Required Fields

- **Contact:** Email or URL for reporting (admin@altivum.ai)
- **Expires:** Date when the file should be considered stale
- **Preferred-Languages:** en

### Optional Fields

- **Policy:** Link to security/disclosure policy (skip for now)
- **Canonical:** URL of this security.txt file

### Implementation Steps

1. **Create directory structure**
   - `public/.well-known/` directory

2. **Create security.txt file**
   - Add required fields
   - Set expiration 1 year from now

### File Content

```
Contact: mailto:admin@altivum.ai
Expires: 2027-01-18T00:00:00.000Z
Preferred-Languages: en
Canonical: https://thechrisgrey.com/.well-known/security.txt
```

### Files to Create

- `public/.well-known/security.txt` (create)

---

## Execution Order

1. Create `security.txt` (2 minutes)
2. Create `ReadingProgressBar` component (10 minutes)
3. Add to `BlogPost.tsx` (2 minutes)
4. Test locally
5. Update docs and commit

---

## Rollback

Both changes are additive and isolated:

- Progress bar: Remove import from BlogPost.tsx, delete component
- security.txt: Delete file from public/.well-known/

---

## Success Criteria

- [ ] security.txt accessible at `https://thechrisgrey.com/.well-known/security.txt`
- [ ] Progress bar visible on blog posts
- [ ] Progress bar fills 0-100% as user scrolls
- [ ] No performance issues (smooth scrolling)
- [ ] Build passes
