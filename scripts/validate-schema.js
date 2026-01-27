#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

try {
  console.log('\n✅ Schema Validator\n');

  // Read manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../ideas/manifest.json'), 'utf8'));

  let passed = 0;
  let failed = 0;
  const errors = [];

  // Validate each idea page
  manifest.ideas.forEach(idea => {
    const filePath = path.join(__dirname, `../ideas/${idea.slug}.html`);

    if (!fs.existsSync(filePath)) {
      errors.push(`${idea.slug}: File not found`);
      failed++;
      return;
    }

    try {
      const html = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(html);
      const scriptTag = $('script[type="application/ld+json"]').first();

      if (!scriptTag.length) {
        errors.push(`${idea.slug}: No JSON-LD schema found`);
        failed++;
        return;
      }

      let schema = {};
      try {
        schema = JSON.parse(scriptTag.html());
      } catch (e) {
        errors.push(`${idea.slug}: Invalid JSON-LD syntax`);
        failed++;
        return;
      }

      if (!schema['@graph']) {
        errors.push(`${idea.slug}: Missing @graph in schema`);
        failed++;
        return;
      }

      const types = schema['@graph'].map(item => item['@type'] || '');
      const required = ['Article', 'SoftwareApplication', 'HowTo', 'BreadcrumbList'];
      const missing = required.filter(type => !types.includes(type));

      if (missing.length > 0) {
        errors.push(`${idea.slug}: Missing ${missing.join(', ')}`);
        failed++;
      } else {
        passed++;
      }

    } catch (error) {
      errors.push(`${idea.slug}: ${error.message}`);
      failed++;
    }
  });

  // Print results
  console.log(`  Pages validated: ${manifest.ideas.length}`);
  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}\n`);

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(err => console.log(`  ⚠️  ${err}`));
    console.log();
  }

  // Check startup-ideas.html ItemList
  console.log('Validating startup-ideas.html...');
  const startupIdeasHtml = fs.readFileSync(path.join(__dirname, '../startup-ideas.html'), 'utf8');
  const $ = cheerio.load(startupIdeasHtml);
  const schemaScript = $('script[type="application/ld+json"]').first();

  if (schemaScript.length > 0) {
    const schema = JSON.parse(schemaScript.html());
    const collectionPage = schema['@graph'].find(item => item['@type'] === 'CollectionPage');

    if (collectionPage && collectionPage.mainEntity) {
      const numberOfItems = collectionPage.mainEntity.numberOfItems;
      const actualItems = collectionPage.mainEntity.itemListElement?.length || 0;

      console.log(`  numberOfItems: ${numberOfItems}`);
      console.log(`  Actual items in ItemList: ${actualItems}`);

      if (numberOfItems !== manifest.ideas.length) {
        console.log(`  ⚠️  numberOfItems (${numberOfItems}) doesn't match manifest (${manifest.ideas.length})`);
      } else {
        console.log(`  ✓ numberOfItems matches manifest`);
      }

      if (actualItems !== numberOfItems) {
        console.log(`  ⚠️  ItemList items (${actualItems}) doesn't match numberOfItems (${numberOfItems})`);
      } else {
        console.log(`  ✓ ItemList items count matches numberOfItems`);
      }
    }
  }
  console.log();

  // Summary
  if (failed === 0) {
    console.log('✅ All validations passed!\n');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} validation(s) failed\n`);
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
