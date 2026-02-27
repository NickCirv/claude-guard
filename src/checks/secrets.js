import { SEVERITY } from '../scanner.js';

// Pattern: [label, regex]
const SECRET_PATTERNS = [
  ['AWS Access Key', /AKIA[0-9A-Z]{16}/],
  ['AWS Secret Key', /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/],
  ['Stripe Secret Key', /sk_(?:live|test)_[0-9a-zA-Z]{24,}/],
  ['Stripe Publishable Key', /pk_(?:live|test)_[0-9a-zA-Z]{24,}/],
  ['Stripe Webhook Secret', /whsec_[0-9a-zA-Z]{32,}/],
  ['GitHub Token', /gh[pousr]_[0-9a-zA-Z]{36,}/],
  ['GitHub Fine-Grained Token', /github_pat_[0-9a-zA-Z_]{82}/],
  ['Generic API Key (assignment)', /(?:api[_-]?key|apikey|api[_-]?secret|app[_-]?secret)\s*[:=]\s*['"]([A-Za-z0-9_\-]{20,})['"]?/i],
  ['Bearer Token (hardcoded)', /(?:Authorization|Bearer)\s*[:=]\s*['"]?Bearer\s+[A-Za-z0-9._\-]{20,}['"]?/i],
  ['Private Key Block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Password (hardcoded assignment)', /(?:password|passwd|pwd)\s*[:=]\s*['"](?!<[^>]+>)[^'"]{6,}['"]/i],
  ['Database URL with credentials', /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/i],
  ['SendGrid API Key', /SG\.[A-Za-z0-9_\-]{22,}\.[A-Za-z0-9_\-]{43,}/],
  ['Twilio Account SID', /AC[a-f0-9]{32}/],
  ['Slack Bot Token', /xox[baprs]-[0-9a-zA-Z]{10,}/],
  ['OpenAI API Key', /sk-[A-Za-z0-9]{48}/],
  ['Anthropic API Key', /sk-ant-[A-Za-z0-9\-_]{40,}/],
];

// Lines we skip — common false positives
const ALLOWLIST_PATTERNS = [
  /example\.com/i,
  /your[_-]?(?:api[_-]?)?key/i,
  /placeholder/i,
  /replace[_-]?me/i,
  /<[A-Z_]+>/,            // <YOUR_SECRET_HERE>
  /\$\{[^}]+\}/,          // ${ENV_VAR}
  /process\.env\./,
  /import\.meta\.env\./,
  /os\.environ/,
  /getenv\(/i,
  /^\s*#/,                // comment lines
  /^\s*\/\//,             // JS comment
  /^\s*\*/,               // JSDoc
];

function isAllowlisted(line) {
  return ALLOWLIST_PATTERNS.some((p) => p.test(line));
}

export function checkSecrets({ fileDiffs, globalConfig }) {
  const findings = [];
  const ignore = globalConfig?.ignore ?? [];

  for (const [file, { added }] of Object.entries(fileDiffs)) {
    if (ignore.some((pattern) => file.includes(pattern))) continue;

    // Skip lock files, dist, generated
    if (/(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.js|dist\/)/.test(file)) continue;

    for (const line of added) {
      if (isAllowlisted(line)) continue;

      for (const [label, pattern] of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          const truncated = line.trim().slice(0, 80);
          findings.push(`${file}: [${label}] ${truncated}`);
          break; // one finding per line
        }
      }
    }
  }

  if (findings.length === 0) {
    return { severity: SEVERITY.GREEN, findings: [] };
  }

  return {
    severity: SEVERITY.RED,
    findings,
  };
}
