#!/usr/bin/env node
/**
 * Generate a compatibility translations flat file for legacy verify scripts.
 * 
 * This creates a file that mirrors the old translations.ts inline format
 * by combining the 3 JSON locale files. Legacy verify scripts that grep
 * for keys in translations.ts can use this file instead.
 * 
 * Usage: node scripts/gen-i18n-compat.js [output-path]
 * Default output: apps/web/src/i18n/.translations-compat.ts
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOCALES_DIR = path.join(ROOT, "apps/web/src/i18n/locales");
const DEFAULT_OUTPUT = path.join(ROOT, "apps/web/src/i18n/.translations-compat.ts");

const outputPath = process.argv[2] || DEFAULT_OUTPUT;

const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
const tr = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "tr.json"), "utf8"));
const es = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "es.json"), "utf8"));

function objToInline(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `  "${k}": "${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
    .join(",\n");
}

const output = `// AUTO-GENERATED compat file for legacy verify scripts — DO NOT EDIT
// Generated from JSON locales at ${new Date().toISOString()}
const en = {
${objToInline(en)}
} as const;

type TranslationKey = keyof typeof en;

const tr: Record<TranslationKey, string> = {
${objToInline(tr)}
};

const es: Record<TranslationKey, string> = {
${objToInline(es)}
};

export const translations = { en, tr, es };
`;

fs.writeFileSync(outputPath, output, "utf8");
console.log(`Generated compat file: ${outputPath} (${Object.keys(en).length} keys per locale)`);
