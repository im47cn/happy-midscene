/**
 * CLI Entry Point for Midscene CI
 *
 * Provides commands for running tests in CI/CD environments,
 * evaluating quality gates, and generating reports.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { version } from '../../package.json';
import { qualityGateCommand } from './commands/qualityGate';
import { reportCommand } from './commands/report';
import { testCommand } from './commands/test';

const argv = yargs(hideBin(process.argv));

Promise.resolve(
  (async () => {
    await argv
      .scriptName('midscene-ci')
      .version(version)
      .usage('$0 <command> [options]')
      .example([
        ['$0 test --suite=regression', 'Run regression test suite'],
        ['$0 test --shard=1 --total-shards=4', 'Run shard 1 of 4'],
        [
          '$0 quality-gate --config=midscene.config.yml',
          'Evaluate quality gate',
        ],
        [
          '$0 report --input=results.json --format=junit,html',
          'Generate reports',
        ],
      ])
      .command(testCommand as any)
      .command(qualityGateCommand as any)
      .command(reportCommand as any)
      .recommendCommands()
      .strict()
      .alias('h', 'help')
      .alias('v', 'version')
      .help()
      .parseAsync();
  })().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  }),
);
