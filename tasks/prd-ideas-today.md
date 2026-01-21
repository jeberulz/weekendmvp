# PRD: Recent Ideas Page (`/ideas/today`)

## 1. Introduction/Overview

Create a dynamic page at `/ideas/today` that automatically displays the most recently posted startup idea. This page will be linked in welcome emails, ensuring every new subscriber sees fresh, relevant content when they click through.

**Problem:** Currently, welcome emails would need to link to a specific idea (which becomes stale) or the general ideas hub (which requires navigation). A dedicated "today" URL provides a consistent, always-fresh entry point.

---

## 2. Goals

- Provide a stable URL (`/ideas/today`) that always shows the most recent idea
- Ensure the page is server-rendered for freshness on every visit
- Maintain visual consistency with existing idea pages
- Zero manual maintenance—automatically updates as new ideas are added

---

## 3. User Stories

### US-001: View Most Recent Idea
**Description:** As a new subscriber clicking the welcome email link, I want to see the most recent startup idea so that I immediately get value from my subscription.

**Acceptance Criteria:**
- [ ] Visiting `/ideas/today` displays the most recently published idea
- [ ] The page content is identical in design to existing idea pages (e.g., `/ideas/ai-meeting-notes-cleaner.html`)
- [ ] The page includes the email gate if user hasn't subscribed via that browser
- [ ] npm run lint passes
- [ ] npm run build passes
- [ ] **Verify in browser:** Page loads and shows idea content

### US-002: Fallback to Older Idea
**Description:** As a subscriber, I want to always see an idea even if no new ones were posted recently, so the page is never empty.

**Acceptance Criteria:**
- [ ] If the ideas directory is not empty, the page always shows the most recent idea (sorted by publish date)
- [ ] There is no "empty state"—always shows the newest available idea
- [ ] npm run lint passes
- [ ] npm run build passes

### US-003: Ideas Manifest for Date Tracking
**Description:** As the system, I need a way to know which idea is most recent, so the `/ideas/today` page can determine what to display.

**Acceptance Criteria:**
- [ ] An `ideas/manifest.json` file exists containing an array of ideas with their slugs and publish dates
- [ ] The manifest is sorted by publish date (newest first)
- [ ] The API/page reads from this manifest to determine the most recent idea
- [ ] npm run lint passes

---

## 4. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | The system must serve `/ideas/today` as a dynamic route (Vercel serverless/edge function) |
| FR-2 | The system must read `ideas/manifest.json` to determine the most recent idea |
| FR-3 | The system must redirect or proxy to the most recent idea's HTML page |
| FR-4 | The manifest must contain: `slug` (string), `publishedAt` (ISO date string), `title` (string) |
| FR-5 | The system must sort ideas by `publishedAt` descending and select the first entry |
| FR-6 | The "Back to Ideas" link on the displayed idea should still work correctly |
| FR-7 | The email gate functionality must work identically to other idea pages |

---

## 5. Non-Goals (Out of Scope)

- **No real-time updates:** Page does not update while user is viewing it
- **No pagination:** Only shows 1 idea, not a list
- **No date filtering:** Does not filter to "only today's ideas"—always shows most recent regardless of age
- **No automatic manifest generation:** Manifest is manually maintained when adding new ideas (can be automated later)
- **No design changes:** Uses existing idea page design exactly

---

## 6. Design Considerations

### URL Structure
- **New URL:** `/ideas/today` → displays most recent idea
- **Existing URLs:** `/ideas/[slug].html` → unchanged

### User Experience Flow
```
Welcome Email → Click Link → /ideas/today → See Most Recent Idea
                                    ↓
                        (Same experience as /ideas/ai-meeting-notes-cleaner.html)
```

### Existing Components to Reuse
- Idea page template: `ideas/_template.html`
- Email gate logic (localStorage check)
- All existing CSS/styling

---

## 7. Technical Considerations

### Implementation Approach: Server-Side Redirect
The simplest approach is a Vercel serverless function that:
1. Reads `ideas/manifest.json`
2. Gets the first (most recent) idea's slug
3. Returns a redirect (302) to `/ideas/[slug].html`

**Why redirect instead of proxy?**
- Simpler implementation
- Existing idea pages work as-is
- Browser URL shows actual idea (better for sharing)
- Caching works normally

### File Structure
```
/ideas/
├── manifest.json          ← NEW: List of ideas with dates
├── today.js               ← NEW: Vercel edge function (or in /api/)
├── _template.html
└── ai-meeting-notes-cleaner.html
```

### Manifest Format
```json
{
  "ideas": [
    {
      "slug": "ai-meeting-notes-cleaner",
      "title": "AI Meeting Notes Cleaner",
      "publishedAt": "2025-01-20"
    }
  ]
}
```

### Vercel Configuration
May need to add a rewrite in `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/ideas/today", "destination": "/api/ideas-today" }
  ]
}
```

---

## 8. Success Metrics

- **Primary:** `/ideas/today` successfully redirects to the most recent idea on every visit
- **Reliability:** Page never shows an error or empty state (always falls back to newest available)
- **Performance:** Redirect completes in <100ms (edge function)

---

## 9. Open Questions

1. **Redirect vs. Proxy:** Should the URL bar show `/ideas/today` (proxy) or the actual idea URL (redirect)?
   - *Current assumption: Redirect (simpler, URL shows actual idea)*

2. **Manifest maintenance:** Should we add a script to auto-generate the manifest from file dates, or is manual OK for now?
   - *Current assumption: Manual for MVP*

3. **Cache headers:** Should we add `Cache-Control: no-cache` to ensure freshness, or is Vercel's default OK?
   - *Current assumption: Use Vercel defaults, add no-cache if needed*
