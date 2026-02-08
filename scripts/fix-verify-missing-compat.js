#!/usr/bin/env node
/**
 * Insert i18n compat block into verify scripts that are missing it.
 * This handles scripts that don't use "set -e" pattern.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const COMPAT_BLOCK = `
# i18n compat: use generated flat file instead of translations.ts
_COMPAT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -n "\${I18N_COMPAT_FILE:-}" ] && [ -f "\${I18N_COMPAT_FILE}" ]; then
  _I18N_COMPAT="$I18N_COMPAT_FILE"
elif [ -f "$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts" ]; then
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
else
  [ -f "$_COMPAT_DIR/scripts/gen-i18n-compat.js" ] && node "$_COMPAT_DIR/scripts/gen-i18n-compat.js" >/dev/null 2>&1 || true
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
fi

`;

const SCRIPTS = [
  "VERIFY_STEP_11_24.sh",
  "VERIFY_STEP_11_25.sh",
  "VERIFY_STEP_11_26.sh",
  "VERIFY_STEP_11_29.sh",
  "VERIFY_STEP_11_32.sh",
  "VERIFY_STEP_11_33.sh",
  "VERIFY_STEP_11_34.sh",
  "VERIFY_STEP_11_35.sh",
  "VERIFY_STEP_11_36.sh",
];

for (const name of SCRIPTS) {
  const filePath = path.join(ROOT, name);
  let content = fs.readFileSync(filePath, "utf8");
  
  if (content.includes("_COMPAT_DIR")) {
    console.log(`SKIP: ${name} (already has compat block)`);
    continue;
  }
  
  // Find insertion point: after shebang + set lines + initial comments
  const lines = content.split("\n");
  let insertIdx = 1; // after shebang
  
  for (let i = 1; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line.startsWith("set ") || line.startsWith("#") || line === "" || line.startsWith("SCRIPT_DIR=")) {
      insertIdx = i + 1;
    } else {
      break;
    }
  }
  
  lines.splice(insertIdx, 0, COMPAT_BLOCK);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  console.log(`FIXED: ${name} (inserted at line ${insertIdx})`);
}
