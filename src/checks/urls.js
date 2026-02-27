import { SEVERITY } from '../scanner.js';

const LOCAL_URL_PATTERNS = [
  { label: 'localhost URL', pattern: /https?:\/\/localhost(?::\d+)?/i },
  { label: '127.0.0.1', pattern: /https?:\/\/127\.0\.0\.1(?::\d+)?/ },
  { label: '0.0.0.0', pattern: /https?:\/\/0\.0\.0\.0(?::\d+)?/ },
  { label: 'local IP (192.168.x.x)', pattern: /https?:\/\/192\.168\.\d{1,3}\.\d{1,3}/ },
  { label: 'local IP (10.x.x.x)', pattern: /https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}/ },
  { label: 'Tailscale IP (100.x.x.x)', pattern: /https?:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}/ },
];

const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\/__tests__\//,
  /test_.*\.py$/,
  /\.min\.js$/,
  // Config / env example files where localhost is expected
  /\.env\.example$/,
  /\.env\.sample$/,
  /docker-compose/,
  /README/i,
];

function isTestOrConfigFile(file) {
  return TEST_FILE_PATTERNS.some((p) => p.test(file));
}

export function checkUrls({ fileDiffs, globalConfig }) {
  const findings = [];
  const ignore = globalConfig?.ignore ?? [];

  for (const [file, { added }] of Object.entries(fileDiffs)) {
    if (isTestOrConfigFile(file)) continue;
    if (ignore.some((p) => file.includes(p))) continue;

    for (const line of added) {
      // Skip comment lines
      if (/^\s*(?:#|\/\/|\*)/.test(line)) continue;

      for (const { label, pattern } of LOCAL_URL_PATTERNS) {
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
