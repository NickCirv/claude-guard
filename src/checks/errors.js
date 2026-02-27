import { SEVERITY } from '../scanner.js';

// Patterns that indicate error handling presence
const ERROR_PATTERNS = [
  /\btry\s*\{/,
  /\bcatch\s*\(/,
  /\.catch\s*\(/,
  /\bon(?:Error|error)\s*[=:]/,
  /\berror\s*=>/,
  /\bthrow\s+new\s+Error/,
  /\braise\s+/,                     // Python
  /\bexcept\s+/,                    // Python
  /\bdefer\s+/,                     // Go (defer + recover pattern)
  /\brecover\s*\(\)/,               // Go
  /\brescue\s+/,                    // Ruby
  /\.unwrap_or\b/,                  // Rust
  /\bResult<|Err\(/,                // Rust
  /\bif\s+err\s*!=\s*nil/,         // Go
];

// Skip test files and type declarations
const SKIP_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\/__tests__\//,
  /\.d\.ts$/,
  /\.min\.js$/,
];

function countErrorHandling(lines) {
  return lines.filter((line) => ERROR_PATTERNS.some((p) => p.test(line))).length;
}

export function checkErrors({ fileDiffs, globalConfig }) {
  const findings = [];
  const ignore = globalConfig?.ignore ?? [];

  for (const [file, { added, removed }] of Object.entries(fileDiffs)) {
    if (SKIP_PATTERNS.some((p) => p.test(file))) continue;
    if (ignore.some((p) => file.includes(p))) continue;

    const removedCount = countErrorHandling(removed);
    const addedCount = countErrorHandling(added);

    if (removedCount > addedCount) {
      const delta = removedCount - addedCount;
      findings.push(`${file}: ${delta} error handler${delta > 1 ? 's' : ''} removed`);
    }
  }

  if (findings.length === 0) {
    return { severity: SEVERITY.GREEN, findings: [] };
  }

  return { severity: SEVERITY.YELLOW, findings };
}
