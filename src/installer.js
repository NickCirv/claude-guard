import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const HOOK_MARKER = '# claude-guard hook';

const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER}
# Installed by claude-guard (https://github.com/NickCirv/claude-guard)
npx claude-guard scan
exit $?
`;

function getGitRoot() {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).trim();
    return root;
  } catch {
    return null;
  }
}

function getHookPath(gitRoot) {
  return join(gitRoot, '.git', 'hooks', 'pre-commit');
}

export async function install({ force = false } = {}) {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.error(chalk.red('Not inside a git repository.'));
    process.exit(1);
  }

  const hooksDir = join(gitRoot, '.git', 'hooks');
  const hookPath = getHookPath(gitRoot);

  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      console.log(chalk.yellow('claude-guard is already installed.'));
      return;
    }
    if (!force) {
      console.error(
        chalk.red('A pre-commit hook already exists.') +
          '\nRun with ' +
          chalk.cyan('--force') +
          ' to overwrite.'
      );
      process.exit(1);
    }
    console.log(chalk.yellow('Overwriting existing pre-commit hook.'));
  }

  writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
  console.log(chalk.green('claude-guard installed as pre-commit hook.'));
  console.log(chalk.dim(`Hook path: ${hookPath}`));
}

export async function uninstall() {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.error(chalk.red('Not inside a git repository.'));
    process.exit(1);
  }

  const hookPath = getHookPath(gitRoot);

  if (!existsSync(hookPath)) {
    console.log(chalk.yellow('No pre-commit hook found.'));
    return;
  }

  const content = readFileSync(hookPath, 'utf8');
  if (!content.includes(HOOK_MARKER)) {
    console.error(
      chalk.red('The pre-commit hook was not installed by claude-guard. Refusing to remove it.')
    );
    process.exit(1);
  }

  unlinkSync(hookPath);
  console.log(chalk.green('claude-guard pre-commit hook removed.'));
}
