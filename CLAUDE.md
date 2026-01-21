# Weekend MVP - Claude Code Guidelines

## Project Overview

Weekend MVP is a static HTML/CSS/JS website for startup idea validation and the Weekend MVP Starter Kit. All pages must be accessible, performant, and follow consistent patterns.

---

## Accessibility Requirements (WCAG 2.1 AA)

**Every page and component MUST follow these accessibility rules. Non-compliance is a bug.**

### Critical Requirements (Must Pass)

#### 1. Icon-Only Buttons
All buttons containing only icons MUST have an `aria-label`:

```html
<!-- CORRECT -->
<button aria-label="Close modal">
    <iconify-icon icon="lucide:x" width="20" aria-hidden="true"></iconify-icon>
</button>

<!-- INCORRECT - Missing aria-label -->
<button>
    <iconify-icon icon="lucide:x" width="20"></iconify-icon>
</button>
```

Common buttons that need aria-labels:
- Close buttons: `aria-label="Close modal"` or `aria-label="Close menu"`
- Menu buttons: `aria-label="Open menu"`
- Copy buttons: `aria-label="Copy to clipboard"`
- Navigation arrows: `aria-label="Next"` / `aria-label="Previous"`

#### 2. Decorative Icons
Icons inside buttons or links MUST have `aria-hidden="true"`:

```html
<button aria-label="Close">
    <iconify-icon icon="lucide:x" aria-hidden="true"></iconify-icon>
</button>
```

#### 3. Logo Accessibility
Logo divs using CSS mask-image MUST have `role="img"` and `aria-label`:

```html
<div class="logo h-4 w-32 text-black" role="img" aria-label="Weekend MVP"></div>
```

#### 4. Form Inputs
All form inputs MUST have associated labels:

```html
<!-- Using label element -->
<label for="email">Email Address</label>
<input type="email" id="email" name="email">

<!-- Or using aria-label for visually hidden labels -->
<input type="email" aria-label="Email address" placeholder="you@example.com">
```

#### 5. Images
All images MUST have alt attributes:

```html
<!-- Informative image -->
<img src="chart.png" alt="Monthly signups chart showing 50% growth">

<!-- Decorative image -->
<img src="decoration.png" alt="">

<!-- Tracking pixels -->
<img height="1" width="1" style="display:none" src="..." alt="">
```

#### 6. External Links
Links opening in new tabs MUST indicate this to screen readers:

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
    External Link<span class="sr-only"> (opens in new tab)</span>
</a>
```

### Serious Requirements (Should Pass)

#### 7. Focus Visibility
Focus indicators MUST be visible. Minimum opacity for focus rings:
- Dark backgrounds: `focus:ring-white/40` (not /20 or lower)
- Light backgrounds: `focus:ring-black/30` (not /10 or lower)

```html
<!-- CORRECT - Visible focus ring -->
<input class="focus:outline-none focus:ring-2 focus:ring-white/40">

<!-- INCORRECT - Nearly invisible -->
<input class="focus:outline-none focus:ring-2 focus:ring-white/10">
```

#### 8. Color-Only Information
Don't convey information with color alone. Add text or icons:

```html
<!-- CORRECT - Text supplements color -->
<span class="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true"></span>
<span class="sr-only">Active:</span>
New ideas added regularly

<!-- INCORRECT - Color only -->
<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
New ideas added regularly
```

### Utility Classes

Always include this CSS for screen-reader-only text:

```css
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
}
```

(Tailwind includes this class by default)

---

## HTML Templates Checklist

When creating new HTML pages, verify:

**Accessibility:**
- [ ] All icon-only buttons have `aria-label`
- [ ] All decorative icons have `aria-hidden="true"`
- [ ] Logo divs have `role="img"` and `aria-label="Weekend MVP"`
- [ ] All form inputs have labels (visible or aria-label)
- [ ] All images have alt attributes
- [ ] External links have `rel="noopener noreferrer"` and sr-only text
- [ ] Focus rings use visible opacity (white/40+ or black/30+)
- [ ] Color-only indicators have supplementary text
- [ ] `lang="en"` on html element
- [ ] Heading hierarchy is logical (h1 > h2 > h3, no skipping)

**SEO/AEO:**
- [ ] Page added to `sitemap.xml`
- [ ] `twitter:image` meta tag present
- [ ] Canonical URL set
- [ ] JSON-LD schema included (if applicable)
- [ ] Email gate content visible by default (if using gate)

---

## Component Patterns

### Close Button (Modal/Menu)
```html
<button id="close-modal" class="..." aria-label="Close modal">
    <iconify-icon icon="lucide:x" width="20" aria-hidden="true"></iconify-icon>
</button>
```

### Mobile Menu Button
```html
<button id="mobile-menu-open" class="..." aria-label="Open menu">
    <iconify-icon icon="lucide:menu" width="24" aria-hidden="true"></iconify-icon>
</button>
```

### Copy Button
```html
<button onclick="copyContent()" class="..." aria-label="Copy to clipboard">
    <iconify-icon icon="lucide:copy" width="18" aria-hidden="true"></iconify-icon>
</button>
```

### External Link
```html
<a href="https://cal.com/..." target="_blank" rel="noopener noreferrer" class="...">
    Book a Consult<span class="sr-only"> (opens in new tab)</span>
</a>
```

### Status Badge
```html
<div class="inline-flex items-center gap-2 ...">
    <span class="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true"></span>
    <span class="sr-only">Active:</span>
    New ideas added regularly
</div>
```

### Logo
```html
<a href="index.html">
    <div class="logo h-4 w-32 text-white" role="img" aria-label="Weekend MVP"></div>
</a>
```

### Form Input
```html
<label for="email" class="...">Email Address</label>
<input type="email" id="email" name="email" required placeholder="you@example.com"
    class="... focus:outline-none focus:ring-2 focus:ring-white/40 ...">
```

---

## Beehiiv Integration

When implementing email subscriptions, follow `BEEHIIV_CURSOR_RULES.md`:

- Endpoint: `https://api.beehiiv.com/v2/publications/{publication_id}/subscriptions`
- Always include `form_id` and `automation_ids` in request body
- Use Vercel Edge runtime for speed
- Read response as text before parsing JSON

---

## SEO & AEO (Answer Engine Optimization)

**All pages must be optimized for both search engines (Google) and AI answer engines (ChatGPT, Perplexity, Claude).**

### Critical Files

| File | Purpose | Update When |
|------|---------|-------------|
| `robots.txt` | Allows AI crawlers (GPTBot, PerplexityBot, Claude-Web) | Rarely changes |
| `sitemap.xml` | Lists all pages for discovery | **Every new page** |

### Sitemap Updates

When adding a new page, add to `sitemap.xml`:

```xml
<url>
  <loc>https://weekendmvp.app/{path}</loc>
  <lastmod>{YYYY-MM-DD}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
```

### Email Gate Pattern (Critical for Crawlers)

**Content MUST be visible by default.** AI crawlers cannot execute JavaScript.

```html
<!-- CORRECT - Content visible by default -->
<div id="email-gate" class="hidden">
    <!-- Gate form here -->
</div>
<div id="gated-content">
    <!-- Main content visible to crawlers -->
</div>
<script>
if (!localStorage.getItem('weekendmvp_subscribed')) {
    document.getElementById('email-gate').classList.remove('hidden');
    document.getElementById('gated-content').classList.add('hidden');
}
</script>

<!-- INCORRECT - Content hidden from crawlers -->
<div id="gated-content" class="hidden">
    <!-- Crawlers see nothing! -->
</div>
```

### Required Meta Tags

Every page needs:

```html
<meta property="twitter:image" content="https://weekendmvp.app/image/og-image.png">
<link rel="canonical" href="https://weekendmvp.app/{path}">
```

### JSON-LD Schema Markup

Include structured data for AI understanding:

**startup-ideas.html:**
- `CollectionPage` + `ItemList` (update numberOfItems and add ListItem for each new idea)
- `FAQPage` with common questions
- `BreadcrumbList`

**Individual idea pages (ideas/*.html):**
- `Article` with headline, description, datePublished
- `SoftwareApplication` with applicationCategory
- `HowTo` with steps
- `BreadcrumbList`

### Application Categories for Schema

| Idea Category | Schema applicationCategory |
|---------------|---------------------------|
| SaaS | BusinessApplication |
| Productivity | ProductivityApplication |
| Health | HealthApplication |
| Fintech | FinanceApplication |
| Education | EducationalApplication |
| Developer | DeveloperApplication |
| Creator | MultimediaApplication |
| E-commerce | ShoppingApplication |

### SEO/AEO Checklist for New Pages

- [ ] Added to `sitemap.xml`
- [ ] `twitter:image` meta tag present
- [ ] Canonical URL set
- [ ] JSON-LD schema included
- [ ] Email gate uses correct visibility pattern (content visible by default)
- [ ] If idea page: Updated `ItemList` in startup-ideas.html

---

## File Structure

```
weekendmvp/
├── index.html              # Main landing page
├── startup-ideas.html      # Ideas collection page (has ItemList schema)
├── starter-kit.html        # Starter kit page
├── privacy-policy.html     # Privacy policy
├── sitemap.xml             # SEO: All pages for search engines
├── robots.txt              # SEO: Crawler permissions (allows AI bots)
├── ideas/                  # Individual idea pages
│   ├── manifest.json       # Ideas metadata
│   ├── _template.html      # Static template
│   ├── _template-dynamic.html  # Dynamic template for skill
│   └── {slug}.html         # Individual idea pages (with schema)
├── api/                    # Vercel API routes
├── scripts.js              # Main JavaScript
├── styles.css              # Custom CSS
└── CLAUDE.md               # This file
```

---

## Testing Accessibility

Before committing, verify accessibility with:

1. **Keyboard navigation**: Tab through all interactive elements
2. **Screen reader**: Test with VoiceOver (Mac) or NVDA (Windows)
3. **Focus visibility**: Ensure focus rings are clearly visible
4. **Axe DevTools**: Run browser extension for automated checks

---

## Quick Reference

| Element | Required Attribute |
|---------|-------------------|
| Icon-only button | `aria-label="..."` |
| Decorative icon | `aria-hidden="true"` |
| Logo div | `role="img" aria-label="Weekend MVP"` |
| Form input | `<label>` or `aria-label` |
| Image | `alt="..."` (empty for decorative) |
| External link | `rel="noopener noreferrer"` + sr-only text |
| Focus ring (dark bg) | `focus:ring-white/40` minimum |
| Focus ring (light bg) | `focus:ring-black/30` minimum |
