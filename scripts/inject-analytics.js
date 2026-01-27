#!/usr/bin/env node

/**
 * Auto-inject Google Analytics, Meta Pixel, and wmvpAnalytics into HTML files
 * 
 * Usage:
 *   node scripts/inject-analytics.js <file.html>
 *   node scripts/inject-analytics.js "articles/*.html"
 *   node scripts/inject-analytics.js "ideas/*.html"
 *   node scripts/inject-analytics.js --update "**/*.html"  # Force update existing
 * 
 * The snippet is loaded from .analytics-snippet.html in the project root.
 * This file contains:
 *   - Google Analytics (G-Z1NYERTKRS) with GDPR consent
 *   - Meta Pixel (1602726847528813) with GDPR consent  
 *   - wmvpAnalytics utility for custom event tracking
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Load the analytics snippet from the source file
function loadAnalyticsSnippet() {
  const snippetPath = path.join(__dirname, '..', '.analytics-snippet.html');
  
  if (!fs.existsSync(snippetPath)) {
    console.error('❌ Error: .analytics-snippet.html not found in project root');
    process.exit(1);
  }
  
  let content = fs.readFileSync(snippetPath, 'utf8');
  
  // Remove the documentation comment block at the top (everything before first <script> or <!-- Google)
  content = content.replace(/^<!--[\s\S]*?-->\s*\n\n/m, '');
  
  // Indent properly for injection into <head>
  const lines = content.split('\n');
  const indentedLines = lines.map(line => line ? '    ' + line : line);
  
  return '\n' + indentedLines.join('\n');
}

// Get the GA snippet (cached)
let GA_SNIPPET = null;
function getSnippet() {
  if (!GA_SNIPPET) {
    GA_SNIPPET = loadAnalyticsSnippet();
  }
  return GA_SNIPPET;
}

function injectAnalytics(filePath, forceUpdate = false) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if GA is already present
    const hasGA = content.includes('G-Z1NYERTKRS') || content.includes('googletagmanager.com/gtag/js');
    const hasWmvpAnalytics = content.includes('wmvpAnalytics');
    
    if (hasGA && !forceUpdate) {
      // Check if it needs the wmvpAnalytics utility added
      if (!hasWmvpAnalytics) {
        console.log(`🔄 ${filePath} - Has GA but missing wmvpAnalytics, use --update to upgrade`);
      } else {
        console.log(`⏭️  Skipping ${filePath} - Analytics already present`);
      }
      return false;
    }
    
    // If forcing update, remove existing analytics
    if (forceUpdate && hasGA) {
      // Remove existing GA snippet (from <!-- Google Analytics to end of Meta Pixel script)
      content = content.replace(
        /\s*<!-- Google Analytics[\s\S]*?<\/script>\s*\n\s*<!-- Meta Pixel[\s\S]*?<\/script>(\s*\n\s*<!-- Weekend MVP Analytics[\s\S]*?<\/script>)?/g,
        ''
      );
      console.log(`🔄 Updating analytics in ${filePath}`);
    }
    
    // Find canonical link and inject after it
    const canonicalPattern = /(<link\s+rel=["']canonical["'][^>]*>)/i;
    const match = content.match(canonicalPattern);
    
    if (!match) {
      console.log(`⚠️  Warning: ${filePath} - No canonical link found, skipping`);
      return false;
    }
    
    // Get the snippet
    const snippet = getSnippet();
    
    // Inject GA snippet right after canonical link
    const newContent = content.replace(
      canonicalPattern,
      `$1${snippet}`
    );
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ ${forceUpdate ? 'Updated' : 'Injected'} analytics in ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Check for --update flag
  const forceUpdate = args.includes('--update');
  const fileArgs = args.filter(arg => arg !== '--update');
  
  if (fileArgs.length === 0) {
    console.log('Weekend MVP Analytics Injection Script');
    console.log('======================================\n');
    console.log('Usage:');
    console.log('  node scripts/inject-analytics.js <file.html>');
    console.log('  node scripts/inject-analytics.js "articles/*.html"');
    console.log('  node scripts/inject-analytics.js "**/*.html"');
    console.log('  node scripts/inject-analytics.js --update "**/*.html"  # Force update existing\n');
    console.log('Options:');
    console.log('  --update    Replace existing analytics with latest snippet');
    console.log('              (includes wmvpAnalytics utility for programmatic pages)\n');
    console.log('The snippet is loaded from .analytics-snippet.html in the project root.');
    process.exit(1);
  }
  
  let files = [];
  
  // Handle glob patterns
  for (const pattern of fileArgs) {
    if (pattern.includes('*')) {
      const matched = await glob(pattern, { ignore: ['node_modules/**', '.git/**', '_template*.html'] });
      files.push(...matched);
    } else {
      files.push(pattern);
    }
  }
  
  // Remove duplicates and filter to HTML files (exclude templates and snippet)
  files = [...new Set(files)]
    .filter(f => f.endsWith('.html'))
    .filter(f => !f.includes('.analytics-snippet'));
  
  if (files.length === 0) {
    console.log('No HTML files found');
    process.exit(1);
  }
  
  console.log(`\n📊 Processing ${files.length} HTML file(s)...`);
  if (forceUpdate) {
    console.log('   Mode: Force update (replacing existing analytics)\n');
  } else {
    console.log('   Mode: Inject only (skip files with existing analytics)\n');
  }
  
  let injected = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(`⚠️  File not found: ${file}`);
      continue;
    }
    
    const hadGA = fs.readFileSync(file, 'utf8').includes('G-Z1NYERTKRS');
    const result = injectAnalytics(file, forceUpdate);
    
    if (result) {
      if (hadGA && forceUpdate) {
        updated++;
      } else {
        injected++;
      }
    } else {
      skipped++;
    }
  }
  
  console.log('\n✨ Done!');
  if (injected > 0) console.log(`   New injections: ${injected}`);
  if (updated > 0) console.log(`   Updated: ${updated}`);
  if (skipped > 0) console.log(`   Skipped: ${skipped}`);
  console.log('');
}

main().catch(console.error);
