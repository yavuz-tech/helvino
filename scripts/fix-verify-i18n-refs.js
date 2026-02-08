#!/usr/bin/env node
/**
 * Fix all legacy verify scripts to use the i18n compat file
 * instead of grepping translations.ts directly.
 *
 * This replaces references to translations.ts with:
 * 1. The I18N_COMPAT_FILE env var (set by VERIFY_ALL.sh)
 * 2. Fallback to .translations-compat.ts
 *
 * Usage: node scripts/fix-verify-i18n-refs.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// All scripts that reference translations.ts
const SCRIPTS = [
  "VERIFY_STEP_11_15.sh",
  "VERIFY_STEP_11_16.sh",
  "VERIFY_STEP_11_18.sh",
  "VERIFY_STEP_11_19.sh",
  "VERIFY_STEP_11_20.sh",
  "VERIFY_STEP_11_21.sh",
  "VERIFY_STEP_11_23.sh",
  "VERIFY_STEP_11_24.sh",
  "VERIFY_STEP_11_25.sh",
  "VERIFY_STEP_11_26.sh",
  "VERIFY_STEP_11_29.sh",
  "VERIFY_STEP_11_30.sh",
  "VERIFY_STEP_11_31.sh",
  "VERIFY_STEP_11_32.sh",
  "VERIFY_STEP_11_33.sh",
  "VERIFY_STEP_11_34.sh",
  "VERIFY_STEP_11_35.sh",
  "VERIFY_STEP_11_36.sh",
  "VERIFY_STEP_11_39.sh",
  "VERIFY_STEP_11_40.sh",
  "VERIFY_STEP_11_41.sh",
  "VERIFY_STEP_11_42.sh",
  "VERIFY_STEP_11_43.sh",
  "VERIFY_STEP_11_44.sh",
  "VERIFY_STEP_11_45.sh",
  "VERIFY_STEP_11_47.sh",
  "VERIFY_STEP_11_48.sh",
  "VERIFY_STEP_11_49.sh",
  "VERIFY_STEP_11_52.sh",
  "VERIFY_STEP_11_55.sh",
  "VERIFY_STEP_11_56.sh",
  "VERIFY_STEP_11_57.sh",
  "VERIFY_STEP_11_58.sh",
];

let totalFixed = 0;

for (const scriptName of SCRIPTS) {
  const scriptPath = path.join(ROOT, scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.log(`SKIP: ${scriptName} not found`);
    continue;
  }

  let content = fs.readFileSync(scriptPath, "utf8");
  const original = content;

  // Add compat file resolution after set -e or shebang if not already present
  if (!content.includes("I18N_COMPAT_FILE") && !content.includes(".translations-compat.ts")) {
    // Find the right insertion point — after set -e/set -euo lines
    const insertAfterPattern = /^(set -e[^\n]*\n)/m;
    const match = content.match(insertAfterPattern);
    if (match) {
      const insertPoint = content.indexOf(match[0]) + match[0].length;
      const compatBlock = `
# i18n compat: use generated flat file instead of translations.ts
_COMPAT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
if [ -n "\${I18N_COMPAT_FILE:-}" ] && [ -f "\${I18N_COMPAT_FILE}" ]; then
  _I18N_COMPAT="\$I18N_COMPAT_FILE"
elif [ -f "\$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts" ]; then
  _I18N_COMPAT="\$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
else
  # Fallback: generate compat on the fly
  [ -f "\$_COMPAT_DIR/scripts/gen-i18n-compat.js" ] && node "\$_COMPAT_DIR/scripts/gen-i18n-compat.js" >/dev/null 2>&1 || true
  _I18N_COMPAT="\$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
fi

`;
      content = content.slice(0, insertPoint) + compatBlock + content.slice(insertPoint);
    }
  }

  // Now replace all translations.ts references with the compat file
  // Pattern 1: Variable assignments like TRANS="...translations.ts"
  content = content.replace(
    /^(\s*(?:TRANS|I18N|I18N_FILE|TRANSLATIONS|TRANS_FILE)\s*=\s*)"[^"]*\/i18n\/translations\.ts"/gm,
    '$1"$_I18N_COMPAT"'
  );
  content = content.replace(
    /^(\s*(?:TRANS|I18N|I18N_FILE|TRANSLATIONS|TRANS_FILE)\s*=\s*)\$[A-Z_]*\/i18n\/translations\.ts$/gm,
    '$1"$_I18N_COMPAT"'
  );
  content = content.replace(
    /^(\s*(?:TRANS|I18N|I18N_FILE|TRANSLATIONS|TRANS_FILE)\s*=\s*)\$[{(][A-Z_]*[})]\/?[^"]*\/i18n\/translations\.ts$/gm,
    '$1"$_I18N_COMPAT"'
  );

  // Pattern 2: Inline grep paths like: grep -q "key" apps/web/src/i18n/translations.ts
  content = content.replace(
    /apps\/web\/src\/i18n\/translations\.ts/g,
    (match, offset) => {
      // Don't replace inside comments or echo strings about the file
      const lineStart = content.lastIndexOf("\n", offset) + 1;
      const line = content.slice(lineStart, content.indexOf("\n", offset));
      // Skip if this is inside the compat block we just added
      if (line.includes("_I18N_COMPAT") || line.includes(".translations-compat.ts")) {
        return match;
      }
      // Skip lines that are just checking if the file exists
      if (line.includes("[ -f") && line.includes("translations.ts") && line.includes("exists")) {
        return match;
      }
      return '"$_I18N_COMPAT"';
    }
  );

  // Pattern 3: $WEB_DIR/src/i18n/translations.ts and similar
  content = content.replace(
    /"\$(?:WEB_DIR|WEB|WEB_SRC|ROOT|REPO_ROOT)\/[^"]*\/i18n\/translations\.ts"/g,
    '"$_I18N_COMPAT"'
  );
  content = content.replace(
    /\$(?:WEB_DIR|WEB|WEB_SRC|ROOT|REPO_ROOT)\/[^\s"]*\/i18n\/translations\.ts/g,
    '"$_I18N_COMPAT"'
  );

  // Clean up any double-quoted double-quotes
  content = content.replace(/""(\$_I18N_COMPAT)""/g, '"$_I18N_COMPAT"');

  if (content !== original) {
    fs.writeFileSync(scriptPath, content, "utf8");
    totalFixed++;
    console.log(`FIXED: ${scriptName}`);
  } else {
    console.log(`SKIP: ${scriptName} (no changes needed)`);
  }
}

console.log(`\nDone: ${totalFixed} scripts updated`);
