import { program } from 'commander';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

import { install, uninstall } from './installer.js';
import { scan } from './scanner.js';
import { showConfig, editConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

program
  .name('claude-guard')
  .description('Pre-commit safety net for AI-generated code')
  .version(pkg.version);

program
  .command('install')
  .description('Install claude-guard as a git pre-commit hook in the current repo')
  .option('--force', 'Overwrite existing pre-commit hook')
  .action(async (opts) => {
    await install(opts);
  });

program
  .command('uninstall')
  .description('Remove the claude-guard pre-commit hook from the current repo')
  .action(async () => {
    await uninstall();
  });

program
  .command('scan')
  .description('Manually scan staged changes')
  .option('--force', 'Continue even if RED findings exist (exit 0)')
  .option('--json', 'Output results as JSON')
  .action(async (opts) => {
    await scan(opts);
  });

program
  .command('config')
  .description('Show or edit guard rules for the current repo')
  .option('--edit', 'Open config in $EDITOR')
  .option('--reset', 'Reset config to defaults')
  .action(async (opts) => {
    if (opts.edit || opts.reset) {
      await editConfig(opts);
    } else {
      await showConfig();
    }
  });

program.parse();
