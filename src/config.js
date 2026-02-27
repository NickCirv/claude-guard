import { existsSync, writeFileSync, readFileSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';
import { join } from 'path';
import chalk from 'chalk';

const CONFIG_FILENAME = '.claude-guard.json';

export const DEFAULT_CONFIG = {
  checks: {
    secrets: { enabled: true, severity: 'red' },
    tests: { enabled: true, severity: 'yellow' },
    errors: { enabled: true, severity: 'yellow' },
    size: { enabled: true, severity: 'yellow', maxLines: 500 },
    deps: { enabled: true, severity: 'yellow' },
    debug: { enabled: true, severity: 'yellow' },
    urls: { enabled: true, severity: 'yellow' },
  },
  ignore: [],
};

function getConfigPath() {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).trim();
    return join(root, CONFIG_FILENAME);
  } catch {
    return join(process.cwd(), CONFIG_FILENAME);
  }
}

export function loadConfig() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, _path: configPath };
  }
  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      checks: { ...DEFAULT_CONFIG.checks, ...parsed.checks },
      ignore: parsed.ignore ?? DEFAULT_CONFIG.ignore,
      _path: configPath,
    };
  } catch {
    console.error(chalk.yellow(`Warning: could not parse ${configPath}. Using defaults.`));
    return { ...DEFAULT_CONFIG, _path: configPath };
  }
}

export async function showConfig() {
  const config = loadConfig();
  const { _path, ...display } = config;

  console.log(chalk.bold('\nClaude Guard Config'));
  console.log(chalk.dim(`Source: ${_path}`));
  console.log('');

  for (const [check, opts] of Object.entries(display.checks)) {
    const status = opts.enabled
      ? opts.severity === 'red'
        ? chalk.red('RED  ')
        : chalk.yellow('WARN ')
      : chalk.dim('OFF  ');
    const extra = opts.maxLines ? chalk.dim(` (max ${opts.maxLines} lines)`) : '';
    console.log(`  ${status} ${check}${extra}`);
  }

  if (display.ignore.length > 0) {
    console.log('');
    console.log(chalk.dim('Ignored patterns:'));
    for (const pattern of display.ignore) {
      console.log(chalk.dim(`  - ${pattern}`));
    }
  }

  console.log('');
  console.log(chalk.dim(`Run ${chalk.cyan('claude-guard config --edit')} to customize.`));
}

export async function editConfig({ edit = false, reset = false } = {}) {
  const configPath = getConfigPath();

  if (reset) {
    const { _path, ...config } = { ...DEFAULT_CONFIG, _path: configPath };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(chalk.green(`Config reset to defaults: ${configPath}`));
    return;
  }

  if (!existsSync(configPath)) {
    const { _path, ...config } = { ...DEFAULT_CONFIG, _path: configPath };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(chalk.dim(`Created default config at ${configPath}`));
  }

  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  const result = spawnSync(editor, [configPath], { stdio: 'inherit' });
  if (result.error) {
    console.error(chalk.red(`Could not open editor: ${result.error.message}`));
    console.log(chalk.dim(`Edit manually: ${configPath}`));
  }
}
