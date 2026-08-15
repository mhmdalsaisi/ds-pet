'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnCli } = require('../lib/cli-process');

if (process.platform !== 'win32') {
  console.log('Windows CLI smoke test skipped on this platform.');
  process.exit(0);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-pet cli '));
const shim = path.join(tempDir, 'dsh.cmd');
fs.writeFileSync(shim, '@echo off\r\necho DSH_%1\r\n');

const child = spawnCli(shim, ['web'], { windowsHide: true });
let output = '';
let error = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { error += chunk; });
child.once('error', (err) => { throw err; });
child.once('exit', (code) => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  assert.strictEqual(code, 0, error);
  assert.match(output, /DSH_web/);
  console.log('Windows .cmd launch smoke test passed.');
});
