const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'scripts', 'managed-files.js');

test('recover restores a journalled file and Git value', (t) => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-contract-test-'));
  t.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  const home = path.join(testRoot, 'home');
  const target = path.join(home, '.codex', 'config.toml');
  const stateRoot = path.join(home, '.local', 'share', 'ai-agent-contract');
  const transactionRoot = path.join(stateRoot, 'transaction');
  const snapshotRoot = path.join(transactionRoot, 'snapshots');
  const globalGit = path.join(testRoot, 'global-git-config');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: globalGit, HOME: home };

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.mkdirSync(snapshotRoot, { recursive: true });
  fs.writeFileSync(target, 'partial\n');
  fs.writeFileSync(path.join(snapshotRoot, '0'), 'original\n');
  fs.writeFileSync(path.join(transactionRoot, 'journal.json'), `${JSON.stringify({
    schemaVersion: 1,
    gitValues: ['/original/hooks'],
    entries: [
      { path: '.codex/config.toml', kind: 'file', mode: 0o644, snapshot: '0' },
    ],
    existingDirectories: ['.codex', '.local', '.local/share', '.local/share/ai-agent-contract'],
  }, null, 2)}\n`);
  execFileSync('git', ['config', '--global', 'core.hooksPath', '/partial/hooks'], { env });

  execFileSync(process.execPath, [helper, 'recover', '--home', home], {
    cwd: root,
    env,
    stdio: 'pipe',
  });

  assert.equal(fs.readFileSync(target, 'utf8'), 'original\n');
  assert.equal(fs.existsSync(transactionRoot), false);
  assert.equal(
    execFileSync('git', ['config', '--global', '--get', 'core.hooksPath'], {
      env,
      encoding: 'utf8',
    }).trim(),
    '/original/hooks',
  );
});
