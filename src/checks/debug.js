import { SEVERITY } from '../scanner.js';

const DEBUG_PATTERNS = [
  { label: 'console.log', pattern: /\bconsole\.log\s*\(/ },
  { label: 'console.debug', pattern: /\bconsole\.debug\s*\(/ },
  { label: 'console.warn (debug)', pattern: /\bconsole\.warn\s*\(.*debug/i },
  { label: 'debugger', pattern: /\bdebugger\b/ },
  { label: 'print() (Python debug)', pattern: /^\s*print\s*\(/ },
  { label: 'var_dump', pattern: /\bvar_dump\s*\(/ },
  { label: 'dd() (Laravel)', pattern: /\bdd\s*\(/ },
  { label: 'pry/binding.pry', pattern: /binding\.pry/ },
  { label: 'byebug', pattern: /\bbyebug\b/ },
  { label: 'TODO/FIXME/HACK', pattern: /\b(?:TODO|FIXME|HACK|XXX)\b/ },
];

const SKIP_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\/__tests__\//,
  /test_.*\.py$/,
  /\.min\.js$/,
  /node_modules\//,
  // Allow console in logger utilities and config files
  /logger\.[jt]sx?$/,
  /logging\.[jt]sx?$/,
];

export function checkDebug({ fileDiffs, globalConfig }) {
  const findings = [];
  const ignore = globalConfig?.ignore ?? [];

  for (const [file, { added }] of Object.entries(fileDiffs)) {
    if (SKIP_PATTERNS.some((p) => p.test(file))) continue;
    if (ignore.some((p) => file.includes(p))) continue;

    for (const line of added) {
      for (const { label, pattern } of DEBUG_PATTERNS) {
        if (pattern.test(line)) {
          findings.push(`${file}: [${label}] ${line.trim().slice(0, 80)}`);
          break;
        }
      }
    }
  }

  if (findings.length === 0) {
    return { severity: SEVERITY.GREEN, findings: [] };
  }

  return { severity: SEVERITY.YELLOW, findings };
}
