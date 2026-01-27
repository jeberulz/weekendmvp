#!/usr/bin/env node

/**
 * Auto-inject Google Analytics and Meta Pixel into HTML files
 * 
 * Usage:
 *   node scripts/inject-analytics.js <file.html>
 *   node scripts/inject-analytics.js "articles/*.html"
 *   node scripts/inject-analytics.js "ideas/*.html"
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// GA snippet to inject (must be in <head> after canonical link)
const GA_SNIPPET = `    
    <!-- Google Analytics - Loaded conditionally after consent -->
    <script>
      // Initialize dataLayer but don't load gtag.js until consent
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      
      // Check for existing consent
      (function() {
        try {
          const stored = localStorage.getItem('analytics_consent');
          if (stored) {
            const parsed = JSON.parse(stored);
            const CONSENT_EXPIRY_DAYS = 365;
            if (parsed.timestamp && Date.now() - parsed.timestamp < CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
              window.analyticsConsent = parsed.value === true;
              if (window.analyticsConsent) {
                // Load GA immediately if consent exists
                const script = document.createElement('script');
                script.async = true;
                script.src = 'https://www.googletagmanager.com/gtag/js?id=G-Z1NYERTKRS';
                document.head.appendChild(script);
                script.onload = function() {
                  window.gtag = function() { dataLayer.push(arguments); };
                  gtag('js', new Date());
                  gtag('config', 'G-Z1NYERTKRS');
                };
                // Initialize Meta Pixel immediately if consent exists
                if (typeof window.fbq === 'function') {
                  window.fbq('init', '1602726847528813');
                  window.fbq('track', 'PageView');
                }
                return;
              }
            }
          }
        } catch(e) {
          console.error('Error checking consent:', e);
        }
        window.analyticsConsent = false;
      })();
      
      // Wrapper to prevent gtag calls before consent
      if (!window.analyticsConsent) {
        window.gtag = function() {
          if (window.analyticsConsent === true) {
            dataLayer.push(arguments);
          }
        };
      } else {
        window.gtag = function() { dataLayer.push(arguments); };
      }
    </script>
    
    <!-- Meta Pixel - Loaded conditionally after consent -->
    <script>
      // Initialize fbq queue but don't load until consent
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      
      // Only initialize if consent exists
      if (window.analyticsConsent === true) {
        fbq('init', '1602726847528813');
        fbq('track', 'PageView');
      } else {
        // Queue the init call for when consent is given
        window.fbqQueue = window.fbqQueue || [];
        window.fbqQueue.push(['init', '1602726847528813']);
        window.fbqQueue.push(['track', 'PageView']);
      }
    </script>
`;

function injectAnalytics(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if GA is already present
    if (content.includes('G-Z1NYERTKRS') || content.includes('googletagmanager.com/gtag/js')) {
      console.log(`⏭️  Skipping ${filePath} - GA already present`);
      return false;
    }
    
    // Find canonical link and inject after it
    const canonicalPattern = /(<link\s+rel=["']canonical["'][^>]*>)/i;
    const match = content.match(canonicalPattern);
    
    if (!match) {
      console.log(`⚠️  Warning: ${filePath} - No canonical link found, skipping`);
      return false;
    }
    
    // Check if there's already something after canonical (like favicon)
    const afterCanonical = content.substring(content.indexOf(match[0]) + match[0].length);
    
    // Inject GA snippet right after canonical link
    const newContent = content.replace(
      canonicalPattern,
      `$1${GA_SNIPPET}`
    );
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Injected GA into ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/inject-analytics.js <file.html> [file2.html ...]');
    console.log('   or: node scripts/inject-analytics.js "**/*.html" (all HTML files)');
    process.exit(1);
  }
  
  let files = [];
  
  // Handle glob patterns
  for (const pattern of args) {
    if (pattern.includes('*')) {
      const matched = await glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
      files.push(...matched);
    } else {
      files.push(pattern);
    }
  }
  
  // Remove duplicates and filter to HTML files
  files = [...new Set(files)].filter(f => f.endsWith('.html'));
  
  if (files.length === 0) {
    console.log('No HTML files found');
    process.exit(1);
  }
  
  console.log(`\n📊 Processing ${files.length} HTML file(s)...\n`);
  
  let injected = 0;
  let skipped = 0;
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(`⚠️  File not found: ${file}`);
      continue;
    }
    
    const result = injectAnalytics(file);
    if (result) {
      injected++;
    } else {
      skipped++;
    }
  }
  
  console.log(`\n✨ Done! Injected: ${injected}, Skipped: ${skipped}\n`);
}

main().catch(console.error);
