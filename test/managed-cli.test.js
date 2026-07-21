const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'scripts', 'managed-files.js');

test('managed CLI rejects unknown options before creating state', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));
  const home = path.join(testRoot, 'home');
  fs.mkdirSync(home);

  const result = spawnSync(process.execPath, [
    helper,
    'recover',
    '--home', home,
    '--typo', 'value',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown option: --typo/i);
  assert.deepEqual(fs.readdirSync(home), []);
});
