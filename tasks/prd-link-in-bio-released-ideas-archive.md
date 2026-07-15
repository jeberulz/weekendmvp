# PRD: Link-in-Bio Released Ideas Archive

## 1. Introduction

Evolve `/links` from a single daily destination into a cumulative archive of released campaign ideas. On each Europe/London calendar day, the newly scheduled idea becomes the featured item and every earlier release remains available below it. Future campaign entries must never be exposed.

The page must remain quick to scan on mobile as the archive grows across campaigns. It will use a featured-today area, audience-facing category filters, search, a secondary video-format filter, and eight-item progressive pagination.

## 2. Resolved Product Decisions

- Today's release is visually featured above the archive.
- Previous releases are ordered newest first.
- Search and business category are the primary discovery controls.
- Video format is available as a secondary filter.
- Eight previous releases appear initially; visitors use `Load more ideas` to reveal the next batch.
- An entry becomes visible at midnight in `Europe/London` on its scheduled date.
- The archive combines every campaign calendar, including future campaigns.
- Campaign production status such as `scripted`, `recorded`, or `published` does not control public visibility.

## 3. Goals

- Show all campaign entries scheduled on or before the current Europe/London date.
- Feature today's entry while keeping earlier releases easy to browse.
- Prevent future entries from appearing in rendered HTML, React Server Component payloads, search results, filters, or counts.
- Keep the initial mobile page compact even after hundreds of releases.
- Make search, filter, and pagination state linkable and restorable through URL parameters.
- Allow new campaign calendars to join the archive without changing page code.

## 4. User Stories

### US-001: Aggregate released entries across campaigns

**Description:** As a visitor, I want the archive to include every released campaign idea so that older videos remain useful.

**Acceptance Criteria:**

- [ ] Read every `content/social/reels/campaigns/*/calendar.csv` file.
- [ ] Include only rows whose `date` is less than or equal to the current `Europe/London` date.
- [ ] Do not use the operational `status` field as a visibility gate.
- [ ] Deduplicate repeated destinations across campaigns by canonical destination path; retain the most recent release record.
- [ ] Sort released entries by ISO release date descending, with a deterministic slug tie-breaker.
- [ ] Missing or malformed calendars and rows fail safely without breaking `/links`.
- [ ] Typecheck passes.

### US-002: Add audience-facing business categories

**Description:** As a visitor, I want to filter by business category so that I can find ideas relevant to my interests.

**Acceptance Criteria:**

- [ ] Add a required `category` value to every campaign row used by `/links`.
- [ ] Use a controlled, human-readable taxonomy rather than free-form near-duplicates.
- [ ] Initial taxonomy is limited to no more than eight broad categories, such as AI & Automation, Creator Tools, Finance, Ecommerce, Marketing & Sales, Productivity, Developer Tools, and Local Business.
- [ ] Category options are generated only from released entries.
- [ ] Category labels render consistently on cards and in controls.
- [ ] A content-data validation check reports missing or unknown category values.

### US-003: Feature today's release above the archive

**Description:** As a visitor arriving from today's social video, I want today's idea to be immediately obvious so that I can open it without searching.

**Acceptance Criteria:**

- [ ] When a row matches today's Europe/London date, render it in a distinct `Today's idea` section above all browsing controls.
- [ ] Exclude today's entry from the `Previously released` archive to avoid duplication.
- [ ] At midnight, yesterday's featured entry automatically becomes the first archive item and the new entry becomes featured.
- [ ] If no entry is scheduled today, omit the featured section and keep the released archive usable.
- [ ] The featured card retains the existing tracked canonical destination and email-gate handoff.
- [ ] Verify at mobile and desktop widths using the in-app Browser skill.

### US-004: Search and filter previous releases

**Description:** As a returning visitor, I want to search and filter older releases so that I can quickly find a relevant idea.

**Acceptance Criteria:**

- [ ] Search matches released-entry titles case-insensitively.
- [ ] Business category is the primary filter and includes an `All` option.
- [ ] Video format is available inside a secondary filter control and uses readable labels.
- [ ] Search, category, and format can be combined.
- [ ] Controls apply only to `Previously released`; today's featured item remains pinned and clearly separate.
- [ ] Active filters and result count are visible without opening the secondary filter control.
- [ ] A clear-all action removes every filter.
- [ ] A helpful empty state appears when no previous releases match.
- [ ] Filter state is encoded as validated URL parameters: `q`, `category`, and `format`.
- [ ] Invalid or unknown parameters fall back safely rather than producing an error.
- [ ] Verify keyboard, screen-reader labels, focus order, mobile overflow, and desktop layout using the in-app Browser skill.

### US-005: Load previous releases in eight-item batches

**Description:** As a mobile visitor, I want a short initial archive with an explicit way to see more so that the page does not become overwhelming.

**Acceptance Criteria:**

- [ ] Render at most eight matching previous releases initially.
- [ ] Show `Load more ideas` only when additional matching releases exist.
- [ ] Each activation reveals the next eight items and preserves search and filter state.
- [ ] Pagination state is represented by a validated positive `page` URL parameter.
- [ ] Back and forward navigation restore the previous visible count and scroll behavior without losing filters.
- [ ] Changing search, category, or format resets pagination to the first batch.
- [ ] The button communicates remaining results or the new total after activation.
- [ ] Do not use infinite scrolling.
- [ ] Verify pagination with 0, 1, 8, 9, 16, and 17 matching previous releases.

### US-006: Update page states, metadata, and verification coverage

**Description:** As a visitor, I want a polished experience in every archive state so that the page feels intentional and trustworthy.

**Acceptance Criteria:**

- [ ] Replace single-day metadata and copy with cumulative archive language while retaining `/links` as canonical.
- [ ] Loading UI reflects a featured card plus a compact archive grid.
- [ ] The no-release state links to `/startup-ideas` without implying an application error.
- [ ] Filtered URLs canonicalize to `/links`.
- [ ] The page remains usable without client-side JavaScript for core navigation and pagination.
- [ ] Future release titles and URLs are absent from production response payloads.
- [ ] Typecheck and production build pass.
- [ ] Browser verification covers today's feature, cumulative releases, filters, empty results, load more, and the email-gate destination.

## 5. Functional Requirements

- **FR-1:** The system must discover all campaign calendars under `content/social/reels/campaigns/*/calendar.csv`.
- **FR-2:** Public visibility must be determined by `row.date <= todayInEuropeLondon`.
- **FR-3:** Operational campaign status must not change visibility.
- **FR-4:** Future entries must be removed before search, filter, count, pagination, and render operations.
- **FR-5:** Today's entry must be separated from earlier released entries.
- **FR-6:** Earlier entries must sort newest first.
- **FR-7:** Repeated canonical destinations must appear once, using their latest release record.
- **FR-8:** Every released row must provide a validated audience-facing category.
- **FR-9:** Search must operate on title text and combine with category and video-format filters.
- **FR-10:** The initial archive must show eight matching entries and add eight per page increment.
- **FR-11:** `q`, `category`, `format`, and `page` must be represented in the URL and validated server-side.
- **FR-12:** Filter changes must reset `page` to 1.
- **FR-13:** Today's featured card must remain visible while archive filters are active.
- **FR-14:** Destination URLs must retain the existing `link_in_bio` UTM parameters.
- **FR-15:** Idea destinations must continue into the existing email-gate workflow.

## 6. UX Structure

1. Compact Weekend MVP header and archive-focused introduction.
2. `Today's idea` featured card when a release exists for the current date.
3. `Previously released` heading with total or filtered result count.
4. Search field.
5. Horizontally scrollable category chips on mobile, with `All` first.
6. Secondary `Filters` control for video format, showing an active-filter count.
7. One-column mobile and two-column desktop card grid, newest first.
8. Full-width `Load more ideas` control after the eighth matching card.
9. Existing Weekend MVP footer.

The filter bar belongs to the previous-release section so visitors understand that today's featured item is intentionally unaffected.

## 7. Technical Considerations

- Keep the current request-time date calculation after Next.js `connection()` so the date is not frozen during deployment.
- Replace `getVideoLinkForDate` with a cached aggregate query that accepts the current ISO date plus validated filter and page inputs.
- Ensure the current date remains part of the cache key so the first request after midnight selects a new release set.
- Discover campaign directories deterministically and sort file paths before parsing.
- Parse and validate category, format, date, slug, title, and source URL at the server boundary.
- Apply release-date filtering before returning any object to the page component.
- Prefer server-rendered GET navigation and links for search, filters, and load more. A small client enhancement is acceptable only if core behavior works without it.
- Keep category taxonomy in one shared constant used by validation and UI labels.
- Add pure-function coverage for date boundaries, multi-calendar aggregation, deduplication, search, combined filters, and page clamping.
- Preserve the existing image lookup and fallback behavior.
- No Convex or database change is required.

## 8. Non-Goals

- No infinite scrolling.
- No numbered-page interface.
- No CMS or admin interface for campaign rows.
- No manual publish toggle for `/links` visibility.
- No Convex schema or authentication change.
- No favorites, saved ideas, or user accounts.
- No embedded social videos.
- No full-text search across idea-body content in this iteration.
- No redesign of the destination idea email gate.

## 9. Success Metrics

- Today’s featured idea remains reachable in one tap from the page.
- No future campaign destination appears in production HTML or RSC payloads.
- A visitor can find an older idea by title or category without scanning more than eight initial archive cards.
- Mobile page height remains bounded to the header, optional featured card, controls, and eight archive cards on first load.
- Filter and pagination state survives refresh, back, forward, and copied URLs.
- All defined boundary cases pass automated and browser verification.

## 10. Rollout Plan

1. Add aggregation, release filtering, deduplication, and deterministic tests.
2. Add the category taxonomy and populate all current campaign rows.
3. Build the featured-today and previous-release layout.
4. Add URL-backed search and filters.
5. Add eight-item load-more pagination.
6. Run current-day, next-day, multi-campaign, mobile, desktop, and email-gate checks.
7. Deploy through a preview, confirm future rows are absent, then promote through the normal `main` deployment.

## 11. Open Questions

No blocking product questions remain. The exact category assigned to each existing campaign row should be reviewed as content work during implementation, without expanding the approved maximum of eight categories.
