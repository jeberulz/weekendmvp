# Google Analytics Auto-Injection

This project includes automatic Google Analytics injection for all HTML pages.

## How It Works

### For New Pages Created via SKILLs

**`/publish-article` and `/publish-idea` SKILLs:**
- Templates (`ideas/_template-dynamic.html` and `ideas/_template.html`) already include GA code
- If generating HTML manually, run the injection script after creation

### Manual Injection

Use the auto-injection script to add GA to any HTML file:

```bash
# Single file
node scripts/inject-analytics.js articles/my-article.html

# Multiple files
node scripts/inject-analytics.js articles/*.html ideas/*.html

# All HTML files (glob pattern)
node scripts/inject-analytics.js "**/*.html"
```

Or use the npm script:
```bash
npm run inject-analytics articles/my-article.html
```

### What Gets Injected

The script automatically adds:
- Google Analytics (GA4) tracking code (`G-Z1NYERTKRS`)
- Meta Pixel tracking code (`1602726847528813`)
- Consent-based loading (respects cookie consent)
- DataLayer initialization

**Location:** Injected right after the `<link rel="canonical">` tag in the `<head>` section.

### Script Features

- ✅ **Idempotent**: Safe to run multiple times (skips files that already have GA)
- ✅ **Smart detection**: Only injects if GA is missing
- ✅ **Preserves formatting**: Maintains existing HTML structure
- ✅ **Error handling**: Reports issues without breaking

### Manual Copy-Paste Option

If you prefer to manually add GA, copy the snippet from:
```
.analytics-snippet.html
```

Paste it right after the `<link rel="canonical">` tag in your HTML file.

## Integration with SKILLs

### `/publish-article` SKILL

After generating HTML in Step 8, the SKILL automatically mentions:
```bash
node scripts/inject-analytics.js articles/{slug}.html
```

### `/publish-idea` SKILL

The `ideas/_template-dynamic.html` template already includes GA code, so new idea pages automatically have tracking. If you're generating HTML manually, run the injection script.

## Verification

To verify GA is working:
1. Open the HTML file in a browser
2. Open DevTools → Network tab
3. Look for requests to `googletagmanager.com/gtag/js`
4. Check Console for any GA-related errors

## Notes

- GA only loads after user consent (via cookie banner)
- The script checks for existing GA before injecting (prevents duplicates)
- All pages should include `scripts.js` for consent banner functionality
