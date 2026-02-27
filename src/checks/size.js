import { SEVERITY } from '../scanner.js';

export function checkSize({ fileDiffs, config, globalConfig }) {
  const findings = [];
  const maxLines = config?.maxLines ?? 500;
  const ignore = globalConfig?.ignore ?? [];

  for (const [file, { added, removed }] of Object.entries(fileDiffs)) {
    if (ignore.some((p) => file.includes(p))) continue;

    // Skip generated / lockfiles
    if (/(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.js|\.map$)/.test(file)) continue;

    const totalChanged = added.length + removed.length;

    if (totalChanged > maxLines) {
      findings.push(
        `${file}: ${totalChanged} lines changed (+${added.length} / -${removed.length})`
      );
    }
  }

  if (findings.length === 0) {
    return { severity: SEVERITY.GREEN, findings: [] };
  }

  return { severity: SEVERITY.YELLOW, findings };
}
