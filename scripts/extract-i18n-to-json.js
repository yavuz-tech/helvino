#!/usr/bin/env node
/**
 * Extract i18n translations from TypeScript to JSON locales
 * Usage: node scripts/extract-i18n-to-json.js
 */

const fs = require("fs");
const path = require("path");

const TRANSLATIONS_PATH = path.join(__dirname, "../apps/web/src/i18n/translations.ts");
const LOCALES_DIR = path.join(__dirname, "../apps/web/src/i18n/locales");

// Read the translations.ts file
const content = fs.readFileSync(TRANSLATIONS_PATH, "utf8");

// Extract a locale object using a balanced brace parser
function extractLocaleObject(localeName, content) {
  const startPattern = new RegExp(`const\\s+${localeName}\\s*[^=]*=\\s*{`);
  const match = content.match(startPattern);
  if (!match) {
    throw new Error(`Failed to find start of ${localeName} object`);
  }
  
  const startIdx = match.index + match[0].length - 1; // position of opening {
  let depth = 0;
  let i = startIdx;
  let objStart = -1;
  let objEnd = -1;
  
  // Find matching closing brace
  while (i < content.length) {
    const char = content[i];
    if (char === '{') {
      if (depth === 0) objStart = i + 1;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        objEnd = i;
        break;
      }
    }
    i++;
  }
  
  if (objStart === -1 || objEnd === -1) {
    throw new Error(`Failed to find balanced braces for ${localeName}`);
  }
  
  const objContent = content.substring(objStart, objEnd);
  const objText = `{${objContent}}`;
  
  // Evaluate to get JS object
  try {
    return new Function(`'use strict'; return (${objText})`)();
  } catch (e) {
    throw new Error(`Failed to evaluate ${localeName}: ${e.message}`);
  }
}

// Extract all locales
console.log("Extracting EN locale...");
const en = extractLocaleObject("en", content);
console.log(`  Found ${Object.keys(en).length} keys`);

console.log("Extracting TR locale...");
const tr = extractLocaleObject("tr", content);
console.log(`  Found ${Object.keys(tr).length} keys`);

console.log("Extracting ES locale...");
const es = extractLocaleObject("es", content);
console.log(`  Found ${Object.keys(es).length} keys`);

// Verify parity
const enKeys = Object.keys(en).sort();
const trKeys = Object.keys(tr).sort();
const esKeys = Object.keys(es).sort();

const enSet = new Set(enKeys);
const trSet = new Set(trKeys);
const esSet = new Set(esKeys);

const missingInTr = enKeys.filter((k) => !trSet.has(k));
const missingInEs = enKeys.filter((k) => !esSet.has(k));
const extraInTr = trKeys.filter((k) => !enSet.has(k));
const extraInEs = esKeys.filter((k) => !enSet.has(k));

if (missingInTr.length > 0) {
  console.error(`\n❌ TR missing ${missingInTr.length} keys:`, missingInTr.slice(0, 10));
  process.exit(1);
}
if (missingInEs.length > 0) {
  console.error(`\n❌ ES missing ${missingInEs.length} keys:`, missingInEs.slice(0, 10));
  process.exit(1);
}
if (extraInTr.length > 0) {
  console.error(`\n❌ TR has ${extraInTr.length} extra keys:`, extraInTr.slice(0, 10));
  process.exit(1);
}
if (extraInEs.length > 0) {
  console.error(`\n❌ ES has ${extraInEs.length} extra keys:`, extraInEs.slice(0, 10));
  process.exit(1);
}

console.log(`\n✅ Parity verified: EN/TR/ES all have same ${enKeys.length} keys`);

// Create locales directory
if (!fs.existsSync(LOCALES_DIR)) {
  fs.mkdirSync(LOCALES_DIR, { recursive: true });
  console.log(`Created directory: ${LOCALES_DIR}`);
}

// Write JSON files with sorted keys for consistency
const sortedEn = {};
enKeys.forEach(k => sortedEn[k] = en[k]);

const sortedTr = {};
enKeys.forEach(k => sortedTr[k] = tr[k]); // Use enKeys order for consistency

const sortedEs = {};
enKeys.forEach(k => sortedEs[k] = es[k]);

fs.writeFileSync(
  path.join(LOCALES_DIR, "en.json"),
  JSON.stringify(sortedEn, null, 2) + "\n",
  "utf8"
);
console.log(`✅ Written: locales/en.json (${Object.keys(sortedEn).length} keys)`);

fs.writeFileSync(
  path.join(LOCALES_DIR, "tr.json"),
  JSON.stringify(sortedTr, null, 2) + "\n",
  "utf8"
);
console.log(`✅ Written: locales/tr.json (${Object.keys(sortedTr).length} keys)`);

fs.writeFileSync(
  path.join(LOCALES_DIR, "es.json"),
  JSON.stringify(sortedEs, null, 2) + "\n",
  "utf8"
);
console.log(`✅ Written: locales/es.json (${Object.keys(sortedEs).length} keys)`);

console.log("\n🎉 Extraction complete!");
console.log(`   Next: Update translations.ts to import these JSON files`);
