import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

test('the server source parses', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  execFileSync(process.execPath, ['--check', path.resolve(directory, '../server.js')], { stdio: 'pipe' });
});
