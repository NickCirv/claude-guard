import { SEVERITY } from '../scanner.js';

const DEP_FILES = ['package.json', 'requirements.txt', 'Pipfile', 'Gemfile', 'go.mod', 'Cargo.toml'];

function extractPackageJsonDeps(lines) {
  const deps = new Set();
  let inDeps = false;

  for (const line of lines) {
    if (/"(?:dependencies|devDependencies|peerDependencies)"\s*:/.test(line)) {
      inDeps = true;
      continue;
    }
    if (inDeps) {
      if (/^\s*\}/.test(line)) {
        inDeps = false;
        continue;
      }
      const match = line.match(/^\s*"([^"]+)"\s*:\s*"([^"]+)"/);
      if (match) deps.add(`${match[1]}@${match[2]}`);
    }
  }

  return deps;
}

function extractRequirementsDeps(lines) {
  return new Set(
    lines
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  );
}

export function checkDeps({ fileDiffs, globalConfig }) {
  const findings = [];
  const ignore = globalConfig?.ignore ?? [];

  for (const [file, { added, removed }] of Object.entries(fileDiffs)) {
    if (ignore.some((p) => file.includes(p))) continue;

    const basename = file.split('/').pop();
    if (!DEP_FILES.includes(basename)) continue;

    let addedDeps, removedDeps;

    if (basename === 'package.json') {
      addedDeps = extractPackageJsonDeps(added);
      removedDeps = extractPackageJsonDeps(removed);
    } else if (basename === 'requirements.txt') {
      addedDeps = extractRequirementsDeps(added);
      removedDeps = extractRequirementsDeps(removed);
    } else {
      // Generic: any added lines in dep files
      if (added.length > 0) {
        findings.push(`${file}: ${added.length} line${added.length > 1 ? 's' : ''} added`);
        for (const line of added.slice(0, 5)) {
          findings.push(`  + ${line.trim()}`);
        }
        if (added.length > 5) findings.push(`  ... and ${added.length - 5} more`);
      }
      continue;
    }

    const newDeps = [...addedDeps].filter((d) => !removedDeps.has(d));
    const droppedDeps = [...removedDeps].filter((d) => !addedDeps.has(d));

    if (newDeps.length > 0) {
      findings.push(`${file}: ${newDeps.length} new dep${newDeps.length > 1 ? 's' : ''} added`);
      for (const dep of newDeps.slice(0, 8)) {
        findings.push(`  + ${dep}`);
      }
      if (newDeps.length > 8) findings.push(`  ... and ${newDeps.length - 8} more`);
    }

    if (droppedDeps.length > 0) {
      findings.push(`${file}: ${droppedDeps.length} dep${droppedDeps.length > 1 ? 's' : ''} removed`);
      for (const dep of droppedDeps.slice(0, 4)) {
        findings.push(`  - ${dep}`);
      }
    }
  }

  if (findings.length === 0) {
    return { severity: SEVERITY.GREEN, findings: [] };
  }

  return { severity: SEVERITY.YELLOW, findings };
}
