import { execFileSync } from 'child_process';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { checkSecrets } from './checks/secrets.js';
import { checkTests } from './checks/tests.js';
import { checkErrors } from './checks/errors.js';
import { checkSize } from './checks/size.js';
import { checkDeps } from './checks/deps.js';
import { checkDebug } from './checks/debug.js';
import { checkUrls } from './checks/urls.js';

export const SEVERITY = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
};

function getStagedDiff() {
  try {
    return execFileSync('git', ['diff', '--cached', '--unified=3'], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function getStagedFiles() {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=ACDMR'],
      { encoding: 'utf8' }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function parseDiffIntoFiles(diff) {
  const files = {};
  let currentFile = null;
  let addedLines = [];
  let removedLines = [];

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files[currentFile] = { added: addedLines, removed: removedLines, raw: files[currentFile]?.raw ?? '' };
      }
      const match = line.match(/diff --git a\/.+ b\/(.+)/);
      currentFile = match ? match[1] : null;
      addedLines = [];
      removedLines = [];
      if (currentFile && !files[currentFile]) {
        files[currentFile] = { added: [], removed: [], raw: '' };
      }
    } else if (currentFile) {
      if (!files[currentFile]) {
        files[currentFile] = { added: [], removed: [], raw: '' };
      }
      files[currentFile].raw += line + '\n';
      if (line.startsWith('+') && !line.startsWith('+++')) {
        files[currentFile].added.push(line.slice(1));
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        files[currentFile].removed.push(line.slice(1));
      }
    }
  }

  if (currentFile && files[currentFile]) {
    files[currentFile].added = addedLines.length ? addedLines : files[currentFile].added;
    files[currentFile].removed = removedLines.length ? removedLines : files[currentFile].removed;
  }

  return files;
}

function printHeader() {
  console.log('');
  console.log(chalk.bold.white('  Claude Guard') + chalk.dim('  pre-commit scan'));
  console.log(chalk.dim('  ' + '─'.repeat(40)));
}

function printResult(result) {
  const icon =
    result.severity === SEVERITY.RED
      ? chalk.red('  BLOCK')
      : result.severity === SEVERITY.YELLOW
        ? chalk.yellow('   WARN')
        : chalk.green('     OK');

  console.log(`${icon}  ${chalk.bold(result.check)}`);

  if (result.findings && result.findings.length > 0) {
    for (const finding of result.findings) {
      console.log(chalk.dim(`         ${finding}`));
    }
  }
}

function printSummary(results, elapsed) {
  const reds = results.filter((r) => r.severity === SEVERITY.RED);
  const yellows = results.filter((r) => r.severity === SEVERITY.YELLOW);

  console.log(chalk.dim('  ' + '─'.repeat(40)));

  if (reds.length > 0) {
    console.log(
      chalk.red.bold(`  ${reds.length} blocker${reds.length > 1 ? 's' : ''}`) +
        chalk.dim(` · ${yellows.length} warning${yellows.length !== 1 ? 's' : ''} · ${elapsed}ms`)
    );
    console.log(chalk.dim('  Fix blockers or run with --force to skip.'));
  } else if (yellows.length > 0) {
    console.log(
      chalk.yellow.bold(`  ${yellows.length} warning${yellows.length !== 1 ? 's' : ''}`) +
        chalk.dim(` · no blockers · ${elapsed}ms`)
    );
  } else {
    console.log(chalk.green.bold('  All checks passed') + chalk.dim(` · ${elapsed}ms`));
  }

  console.log('');
}

export async function scan({ force = false, json = false } = {}) {
  const start = Date.now();
  const config = loadConfig();
  const diff = getStagedDiff();
  const stagedFiles = getStagedFiles();

  if (!diff && stagedFiles.length === 0) {
    if (!json) {
      console.log(chalk.dim('No staged changes to scan.'));
    }
    return;
  }

  const fileDiffs = parseDiffIntoFiles(diff);

  const checkRunners = [
    { key: 'secrets', fn: checkSecrets },
    { key: 'tests', fn: checkTests },
    { key: 'errors', fn: checkErrors },
    { key: 'size', fn: checkSize },
    { key: 'deps', fn: checkDeps },
    { key: 'debug', fn: checkDebug },
    { key: 'urls', fn: checkUrls },
  ];

  const results = [];

  for (const { key, fn } of checkRunners) {
    const checkConfig = config.checks[key];
    if (!checkConfig || !checkConfig.enabled) continue;

    try {
      const result = await fn({ fileDiffs, stagedFiles, diff, config: checkConfig, globalConfig: config });
      if (result) {
        results.push({ check: key, ...result });
      }
    } catch (err) {
      results.push({
        check: key,
        severity: SEVERITY.YELLOW,
        findings: [`Check errored: ${err.message}`],
      });
    }
  }

  const elapsed = Date.now() - start;

  if (json) {
    console.log(JSON.stringify({ results, elapsed, stagedFiles }, null, 2));
    const hasBlockers = results.some((r) => r.severity === SEVERITY.RED);
    if (hasBlockers && !force) process.exit(1);
    return;
  }

  printHeader();

  if (results.length === 0) {
    console.log(chalk.green('  All checks passed'));
    console.log('');
    return;
  }

  for (const result of results) {
    printResult(result);
  }

  printSummary(results, elapsed);

  const hasBlockers = results.some((r) => r.severity === SEVERITY.RED);
  if (hasBlockers && !force) {
    process.exit(1);
  }
}
