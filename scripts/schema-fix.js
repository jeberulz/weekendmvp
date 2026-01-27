#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

try {
  const cheerio = require('cheerio');

  // Read manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../ideas/manifest.json'), 'utf8'));

  let fixed = 0;
  let errors = [];

  console.log(`\n🔧 Schema Fixer - Processing ${manifest.ideas.length} ideas...\n`);

  manifest.ideas.forEach(idea => {
    const filePath = path.join(__dirname, `../ideas/${idea.slug}.html`);

    // Skip if file doesn't exist
    if (!fs.existsSync(filePath)) {
      errors.push(`⚠️  ${idea.slug}: File not found`);
      return;
    }

    try {
      const html = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(html);

      // Find existing JSON-LD script
      let scriptTag = $('script[type="application/ld+json"]').first();
      let schema = {};

      // Parse existing schema or create new one
      if (scriptTag.length > 0) {
        try {
          schema = JSON.parse(scriptTag.html());
        } catch (e) {
          schema = {
            "@context": "https://schema.org",
            "@graph": []
          };
        }
      } else {
        schema = {
          "@context": "https://schema.org",
          "@graph": []
        };
      }

      // Ensure @graph exists
      if (!schema['@graph']) {
        schema['@graph'] = [];
      }

      // Check for existing schemas
      const types = schema['@graph'].map(item => item['@type'] || '');

      let modified = false;

      // Add Article if missing
      if (!types.includes('Article')) {
        schema['@graph'].push({
          "@type": "Article",
          "headline": idea.title,
          "description": idea.description || idea.tagline || '',
          "author": { "@id": "https://weekendmvp.app/#person" },
          "publisher": { "@id": "https://weekendmvp.app/#website" },
          "datePublished": idea.publishedAt || new Date().toISOString().split('T')[0],
          "mainEntityOfPage": `https://weekendmvp.app/ideas/${idea.slug}.html`,
          "image": "https://weekendmvp.app/image/og-image.png"
        });
        modified = true;
      }

      // Add SoftwareApplication if missing
      if (!types.includes('SoftwareApplication')) {
        const categoryMap = {
          'saas': 'BusinessApplication',
          'productivity': 'ProductivityApplication',
          'health': 'HealthApplication',
          'fintech': 'FinanceApplication',
          'education': 'EducationalApplication',
          'developer-tools': 'DeveloperApplication',
          'creator-tools': 'MultimediaApplication',
          'ecommerce': 'ShoppingApplication',
          'automation': 'BusinessApplication',
          'b2b': 'BusinessApplication',
          'marketplace': 'BusinessApplication',
          'ai-tools': 'BusinessApplication'
        };

        schema['@graph'].push({
          "@type": "SoftwareApplication",
          "name": idea.title,
          "applicationCategory": categoryMap[idea.category] || 'BusinessApplication',
          "operatingSystem": "Web",
          "description": idea.description || idea.tagline || ''
        });
        modified = true;
      }

      // Add HowTo if missing
      if (!types.includes('HowTo')) {
        schema['@graph'].push({
          "@type": "HowTo",
          "name": `Build ${idea.title} MVP`,
          "description": `Step-by-step guide to building ${idea.title} in a weekend.`,
          "totalTime": `PT${idea.buildTime || 8}H`,
          "step": [
            {
              "@type": "HowToStep",
              "position": 1,
              "name": "Project Setup",
              "text": "Set up your development environment and project structure."
            },
            {
              "@type": "HowToStep",
              "position": 2,
              "name": "Core Feature",
              "text": "Build the main feature of your MVP."
            },
            {
              "@type": "HowToStep",
              "position": 3,
              "name": "Landing Page",
              "text": "Create a landing page to showcase your MVP."
            }
          ]
        });
        modified = true;
      }

      // Add BreadcrumbList if missing
      if (!types.includes('BreadcrumbList')) {
        schema['@graph'].push({
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://weekendmvp.app/" },
            { "@type": "ListItem", "position": 2, "name": "Startup Ideas", "item": "https://weekendmvp.app/startup-ideas.html" },
            { "@type": "ListItem", "position": 3, "name": idea.title, "item": `https://weekendmvp.app/ideas/${idea.slug}.html` }
          ]
        });
        modified = true;
      }

      // Write back if schema was modified
      if (modified) {
        if (scriptTag.length > 0) {
          scriptTag.html(JSON.stringify(schema, null, 2));
        } else {
          // Add new script tag to head
          const headClosing = html.indexOf('</head>');
          if (headClosing !== -1) {
            const newScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(schema, null, 2)}\n    </script>\n    `;
            const newHtml = html.slice(0, headClosing) + newScript + html.slice(headClosing);
            fs.writeFileSync(filePath, newHtml);
          }
        }

        // Re-load and write if using cheerio's manipulation
        if (scriptTag.length > 0) {
          fs.writeFileSync(filePath, $.html());
        }

        console.log(`✓ ${idea.slug}.html - Added missing schemas`);
        fixed++;
      } else {
        console.log(`✓ ${idea.slug}.html - Already complete`);
      }
    } catch (error) {
      errors.push(`❌ ${idea.slug}: ${error.message}`);
    }
  });

  console.log(`\n✅ Fixed ${fixed}/${manifest.ideas.length} pages\n`);

  if (errors.length > 0) {
    console.log('⚠️  Errors encountered:');
    errors.forEach(err => console.log(`   ${err}`));
  }

  process.exit(errors.length > 0 ? 1 : 0);

} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('\n❌ Error: cheerio module not found');
    console.error('   Install with: npm install cheerio\n');
    process.exit(1);
  }
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
