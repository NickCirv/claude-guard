import { SEVERITY } from '../scanner.js';

const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\/__tests__\//,
  /_test\.(?:py|go|rb)$/,
  /test_.*\.py$/,
  /_spec\.rb$/,
];

const TEST_BODY_PATTERNS = [
  /\b(?:it|test|describe|expect|assert|should|given|when|then)\s*\(/,
  /^\s*(?:def test_|func Test)/,   // Python / Go
  /\bit\s+['"].*['"]\s*do/,        // RSpec
];

function isTestFile(filename) {
  return TEST_FILE_PATTERNS.some((p) => p.test(filename));
}

function countTestStatements(lines) {
  return lines.filter((line) => TEST_BODY_PATTERNS.some((p) => p.test(line))).length;
}

export function checkTests({ fileDiffs, stagedFiles, globalConfig }) {
  const findings = [];
  const ignore = globalConfig?.ignore ?? [];

  // 1. Detect deleted test files
  const allFiles = Object.keys(fileDiffs);
  const deletedTestFiles = stagedFiles
    .filter((f) => isTestFile(f))
    .filter((f) => {
      const diff = fileDiffs[f];
      if (!diff) return false;
      // All lines are removals = file deleted
      return diff.added.length === 0 && diff.removed.length > 0;
    });

  for (const f of deletedTestFiles) {
    if (!ignore.some((p) => f.includes(p))) {
      findings.push(`${f}: test file deleted`);
    }
  }

  // 2. Detect significant decrease in test count in modified test files
  for (const [file, { added, removed }] of Object.entries(fileDiffs)) {
    if (!isTestFile(file)) continue;
    if (ignore.some((p) => file.includes(p))) continue;

    const addedCount = countTestStatements(added);
    const removedCount = countTestStatements(removed);

    if (removedCount > addedCount) {
      const delta = removedCount - addedCount;
      findings.push(`${file}: ${delta} test${delta > 1 ? 's' : ''} removed`);
    }
  }

  if (findings.length === 0) {
    return { severity: SEVERITY.GREEN, findings: [] };
  }

  return { severity: SEVERITY.YELLOW, findings };
}
