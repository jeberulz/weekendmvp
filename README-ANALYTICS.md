# Google Analytics & Programmatic SEO Tracking

This project includes automatic Google Analytics injection and custom event tracking for programmatic SEO pages.

## Overview

The analytics system includes:
1. **Google Analytics (GA4)** - Core tracking (`G-Z1NYERTKRS`)
2. **Meta Pixel** - Facebook/Instagram tracking (`1602726847528813`)
3. **wmvpAnalytics** - Custom event tracking utility for programmatic pages
4. **GDPR Compliance** - Consent-based loading

## Quick Start

### For New Pages Created via SKILLs

**`/publish-article` and `/publish-idea` SKILLs:**
- Templates already include GA code
- If generating HTML manually, run the injection script after creation

### Manual Injection

```bash
# Single file
node scripts/inject-analytics.js articles/my-article.html

# Multiple files with glob
node scripts/inject-analytics.js "articles/*.html" "ideas/*.html"

# All HTML files
node scripts/inject-analytics.js "**/*.html"

# Force update existing files (adds wmvpAnalytics utility)
node scripts/inject-analytics.js --update "**/*.html"
```

## What Gets Injected

The script adds (from `.analytics-snippet.html`):

| Component | Purpose |
|-----------|---------|
| Google Analytics | Page views, core metrics |
| Meta Pixel | Facebook/Instagram conversion tracking |
| wmvpAnalytics | Custom events for programmatic SEO pages |

**Location:** Injected right after `<link rel="canonical">` in `<head>`.

---

## wmvpAnalytics Utility

The `wmvpAnalytics` utility provides custom event tracking for programmatic SEO pages. It's automatically included when you inject analytics.

### Auto-Detection

The utility automatically detects page type from URL and fires appropriate events:

| URL Pattern | Event |
|-------------|-------|
| `/ideas/{category}/` | `view_category` |
| `/build-with/{tool}/` | `view_tool_page` |
| `/ideas-for/{audience}/` | `view_audience_page` |
| `/ideas/{revenue-goal}/` | `view_revenue_goal` |
| `/solve/{problem}/` | `view_problem_page` |
| `/ideas/{slug}.html` | `view_idea` |

### Manual Tracking

For explicit tracking, use these methods:

```javascript
// Category page (e.g., /ideas/saas/)
wmvpAnalytics.trackCategory('saas', 12);

// Tool page (e.g., /build-with/cursor/)
wmvpAnalytics.trackTool('cursor', 15);

// Audience page (e.g., /ideas-for/developers/)
wmvpAnalytics.trackAudience('developers', 8);

// Revenue goal page (e.g., /ideas/1k-month/)
wmvpAnalytics.trackRevenueGoal('1k-month', 10);

// Problem page (e.g., /solve/invoicing/)
wmvpAnalytics.trackProblem('invoicing', 5);

// Build time page (e.g., /ideas/build-in-weekend/)
wmvpAnalytics.trackBuildTime('build-in-weekend', 6);

// Individual idea
wmvpAnalytics.trackIdea('ai-meeting-notes-cleaner', 'SaaS');
```

### User Interaction Events

```javascript
// Internal link clicks (for navigation analysis)
wmvpAnalytics.trackInternalLink('category_to_idea', 'ai-meeting-notes-cleaner');

// CTA button clicks
wmvpAnalytics.trackCTA('get_starter_kit', 'hero_section');

// Email signups (also fires Meta Pixel Lead event)
wmvpAnalytics.trackEmailSignup('ideas_page', 'newsletter');

// Copy-to-clipboard (AI prompts, code)
wmvpAnalytics.trackCopy('ai_prompt', 'ai-meeting-notes-cleaner');

// Filter/search interactions
wmvpAnalytics.trackFilter('category', 'saas');
```

### Raw Event Tracking

For custom events not covered above:

```javascript
wmvpAnalytics.track('custom_event_name', {
  custom_param: 'value',
  another_param: 123
});
```

### Data Attributes for Auto-Detection

Add these attributes to HTML elements for accurate counting:

```html
<!-- Idea cards (for counting ideas on collection pages) -->
<div data-idea-card>...</div>

<!-- Solution cards (for problem pages) -->
<div data-solution-card>...</div>

<!-- Idea category (for individual idea pages) -->
<article data-idea-category="SaaS">...</article>
```

---

## Script Features

- ✅ **Idempotent**: Safe to run multiple times (skips files with analytics)
- ✅ **Update mode**: `--update` flag replaces existing with latest snippet
- ✅ **GDPR compliant**: Only loads after user consent
- ✅ **Event queue**: Events are queued until GA loads
- ✅ **Auto-detection**: Programmatic pages tracked automatically

---

## Files

| File | Purpose |
|------|---------|
| `.analytics-snippet.html` | Source of truth for analytics code |
| `scripts/inject-analytics.js` | Injection script |
| `scripts.js` | Cookie consent banner handling |

---

## Integration with SKILLs

### `/publish-article` SKILL
After generating HTML, run:
```bash
node scripts/inject-analytics.js articles/{slug}.html
```

### `/publish-idea` SKILL
Templates include GA. For manual HTML:
```bash
node scripts/inject-analytics.js ideas/{slug}.html
```

### `/publish-programmatic` SKILL (planned)
Templates will include wmvpAnalytics with auto-tracking.

---

## Verification

1. Open the HTML file in a browser
2. Open DevTools → Network tab
3. Look for requests to `googletagmanager.com/gtag/js`
4. In Console, check `wmvpAnalytics` is defined
5. Check Google Analytics Realtime for events

### Debug Mode

```javascript
// In browser console, check queued events
wmvpAnalytics.flushQueue();

// Manually trigger auto-detection
wmvpAnalytics.autoTrack();
```

---

## GA4 Events Reference

| Event Name | Parameters | Page Types |
|------------|------------|------------|
| `view_category` | `category_name`, `idea_count`, `page_path` | Category collections |
| `view_tool_page` | `tool_name`, `idea_count`, `page_path` | Tool landing pages |
| `view_audience_page` | `audience_name`, `idea_count`, `page_path` | Audience hubs |
| `view_revenue_goal` | `revenue_goal`, `idea_count`, `page_path` | Revenue goal pages |
| `view_problem_page` | `problem_name`, `solution_count`, `page_path` | Problem/solution pages |
| `view_build_time` | `build_time`, `idea_count`, `page_path` | Build time pages |
| `view_idea` | `idea_slug`, `idea_category`, `page_path` | Individual ideas |
| `internal_link_click` | `link_type`, `destination`, `source_path` | All pages |
| `cta_click` | `cta_name`, `cta_location`, `page_path` | All pages |
| `email_signup` | `signup_source`, `form_type`, `page_path` | All pages |
| `copy_content` | `content_type`, `idea_slug`, `page_path` | Idea pages |
| `filter_applied` | `filter_type`, `filter_value`, `page_path` | Collection pages |

---

## Notes

- GA only loads after user consent (cookie banner)
- All events respect consent state (queued if consent not given)
- The inject script excludes template files (`_template*.html`)
- Update existing pages with `--update` to add wmvpAnalytics utility
